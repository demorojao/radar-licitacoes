"""Cliente da API de consulta do PNCP: paginação e nova tentativa em falhas temporárias.

Detalhes da API usados aqui estão em docs/api-pncp.md.
"""

import logging
import re
import time
from collections.abc import Callable
from dataclasses import dataclass
from datetime import date
from decimal import Decimal
from typing import Any

import httpx
from pydantic import ValidationError

from radar_coletor.modelos import Contratacao, PaginaPNCP

log = logging.getLogger(__name__)

URL_API_CONSULTA = "https://pncp.gov.br/api/consulta"
CAMINHO_PROPOSTAS_ABERTAS = "/v1/contratacoes/proposta"
USER_AGENT = "radar-licitacoes/0.1 (+https://github.com/demorojao/radar-licitacoes)"

TAMANHO_PAGINA_MINIMO = 10
TAMANHO_PAGINA_MAXIMO = 50
# "dataFinal" significa "prazo de proposta encerra até". A maior data aceita traz todas as abertas.
DATA_FINAL_MAXIMA = date(9999, 12, 31)
# Respostas que valem uma nova tentativa: limite de uso (429) e erros temporários do servidor.
CODIGOS_TEMPORARIOS = frozenset({429, 500, 502, 503, 504})


class ErroAPIPNCP(Exception):
    """A API respondeu com erro, com conteúdo inesperado ou ficou fora em todas as tentativas."""


@dataclass(frozen=True)
class RegistroInvalido:
    """Registro que não passou na validação (dado sujo na fonte). A coleta continua sem ele."""

    numero_controle_pncp: str | None
    erro: str


@dataclass(frozen=True)
class ResultadoListagem:
    contratacoes: list[Contratacao]
    invalidos: list[RegistroInvalido]
    paginas_lidas: int
    # Resposta original de cada contratação válida, pela chave, para guardar no banco.
    brutos: dict[str, dict[str, Any]]


def criar_cliente_http(
    timeout_segundos: float = 60.0, transport: httpx.BaseTransport | None = None
) -> httpx.Client:
    """Cria o cliente HTTP da API de consulta. `transport` permite simular a API nos testes."""
    return httpx.Client(
        base_url=URL_API_CONSULTA,
        timeout=timeout_segundos,
        headers={"User-Agent": USER_AGENT, "Accept": "application/json"},
        transport=transport,
    )


class ClientePNCP:
    """Busca contratações com proposta aberta, página por página."""

    # Valores medidos em 18/11/2026: com 0,5 s entre as páginas a API respondeu 429 (limite de
    # uso) na 43ª página, e esperas de 1, 2, 4 e 8 s não bastaram; com 3 s, nenhum 429.
    def __init__(
        self,
        http: httpx.Client,
        *,
        max_tentativas: int = 6,
        espera_inicial: float = 5.0,
        espera_maxima: float = 120.0,
        pausa_entre_paginas: float = 3.0,
        limite_paginas: int = 500,
        dormir: Callable[[float], None] = time.sleep,
    ) -> None:
        if max_tentativas < 1:
            raise ValueError("max_tentativas deve ser pelo menos 1")
        self._http = http
        self._max_tentativas = max_tentativas
        self._espera_inicial = espera_inicial
        self._espera_maxima = espera_maxima
        self._pausa_entre_paginas = pausa_entre_paginas
        self._limite_paginas = limite_paginas
        self._dormir = dormir

    def buscar_pagina_propostas(
        self,
        *,
        uf: str,
        pagina: int,
        data_final: date = DATA_FINAL_MAXIMA,
        tamanho_pagina: int = TAMANHO_PAGINA_MAXIMO,
    ) -> PaginaPNCP | None:
        """Busca uma página de contratações com proposta aberta.

        Devolve None quando a API responde 204 (sem conteúdo): página depois da última ou
        filtro sem resultado.
        """
        if not re.fullmatch(r"[A-Z]{2}", uf):
            raise ValueError(f"UF deve ter duas letras maiúsculas: {uf!r}")
        if pagina < 1:
            raise ValueError(f"A página começa em 1: {pagina}")
        if not TAMANHO_PAGINA_MINIMO <= tamanho_pagina <= TAMANHO_PAGINA_MAXIMO:
            raise ValueError(
                f"A API aceita de {TAMANHO_PAGINA_MINIMO} a {TAMANHO_PAGINA_MAXIMO} itens "
                f"por página: {tamanho_pagina}"
            )

        resposta = self._get(
            CAMINHO_PROPOSTAS_ABERTAS,
            {
                "dataFinal": data_final.strftime("%Y%m%d"),
                "uf": uf,
                "pagina": pagina,
                "tamanhoPagina": tamanho_pagina,
            },
        )
        if resposta.status_code == 204:
            return None
        if resposta.status_code != 200:
            raise ErroAPIPNCP(
                f"HTTP {resposta.status_code} em {CAMINHO_PROPOSTAS_ABERTAS}: "
                f"{_mensagem_de_erro(resposta)}"
            )
        try:
            # parse_float=Decimal: valor em dinheiro nunca passa por float.
            return PaginaPNCP.model_validate(resposta.json(parse_float=Decimal))
        except ValueError as erro:  # JSON inválido ou formato inesperado (ValidationError)
            raise ErroAPIPNCP(f"Resposta inesperada da API na página {pagina}: {erro}") from erro

    def listar_propostas_abertas(
        self, *, uf: str = "SC", data_final: date = DATA_FINAL_MAXIMA
    ) -> ResultadoListagem:
        """Percorre todas as páginas e valida cada registro separadamente."""
        por_chave: dict[str, Contratacao] = {}
        brutos: dict[str, dict[str, Any]] = {}
        invalidos: list[RegistroInvalido] = []
        paginas_lidas = 0

        while True:
            if paginas_lidas >= self._limite_paginas:
                raise ErroAPIPNCP(
                    f"Mais de {self._limite_paginas} páginas: a paginação da API não terminou."
                )
            pagina = self.buscar_pagina_propostas(
                uf=uf, pagina=paginas_lidas + 1, data_final=data_final
            )
            if pagina is None:
                break
            paginas_lidas += 1

            for bruto in pagina.registros:
                try:
                    contratacao = Contratacao.model_validate(bruto)
                except ValidationError as erro:
                    invalidos.append(RegistroInvalido(_chave_do_registro(bruto), _resumir(erro)))
                    continue
                # A lista pode mudar enquanto paginamos: a chave evita duplicar registros.
                por_chave[contratacao.numero_controle_pncp] = contratacao
                brutos[contratacao.numero_controle_pncp] = bruto

            if pagina.paginas_restantes <= 0:
                break
            self._dormir(self._pausa_entre_paginas)

        if invalidos:
            log.warning("PNCP: %d registro(s) inválido(s) ignorado(s)", len(invalidos))
        return ResultadoListagem(list(por_chave.values()), invalidos, paginas_lidas, brutos)

    def _get(self, caminho: str, params: dict[str, str | int]) -> httpx.Response:
        motivo = ""
        for tentativa in range(1, self._max_tentativas + 1):
            try:
                resposta = self._http.get(caminho, params=params)
            except httpx.TransportError as erro:
                motivo = f"falha de rede ({type(erro).__name__})"
                espera = self._calcular_espera(tentativa, retry_after=None)
            else:
                if resposta.status_code not in CODIGOS_TEMPORARIOS:
                    return resposta
                motivo = f"HTTP {resposta.status_code}"
                espera = self._calcular_espera(tentativa, resposta.headers.get("Retry-After"))

            if tentativa < self._max_tentativas:
                log.warning(
                    "PNCP: %s em %s; nova tentativa em %.1f s (%d de %d)",
                    motivo,
                    caminho,
                    espera,
                    tentativa + 1,
                    self._max_tentativas,
                )
                self._dormir(espera)

        raise ErroAPIPNCP(f"{motivo} em {caminho}, depois de {self._max_tentativas} tentativas")

    def _calcular_espera(self, tentativa: int, retry_after: str | None) -> float:
        """Espera exponencial (5 s, 10 s, 20 s...) com teto. Respeita o Retry-After em segundos."""
        if retry_after is not None and retry_after.strip().isdigit():
            return min(float(retry_after), self._espera_maxima)
        return min(self._espera_inicial * 2.0 ** (tentativa - 1), self._espera_maxima)


def _mensagem_de_erro(resposta: httpx.Response) -> str:
    try:
        corpo = resposta.json()
    except ValueError:
        return resposta.text[:200]
    if isinstance(corpo, dict) and isinstance(corpo.get("message"), str):
        return str(corpo["message"])
    return resposta.text[:200]


def _chave_do_registro(bruto: dict[str, Any]) -> str | None:
    chave = bruto.get("numeroControlePNCP")
    return chave if isinstance(chave, str) else None


def _resumir(erro: ValidationError) -> str:
    return "; ".join(
        f"{'.'.join(str(parte) for parte in item['loc'])}: {item['msg']}"
        for item in erro.errors()[:3]
    )
