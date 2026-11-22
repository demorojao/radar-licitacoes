"""Testes do cliente da API do PNCP. Nenhum teste acessa a rede: o MockTransport simula a API."""

import json
from collections.abc import Callable
from decimal import Decimal
from pathlib import Path
from typing import Any

import httpx
import pytest

from radar_coletor.cliente import (
    USER_AGENT,
    ClientePNCP,
    ErroAPIPNCP,
    criar_cliente_http,
)

FIXTURES = Path(__file__).parent / "fixtures"
PAGINA_REAL: dict[str, Any] = json.loads(
    (FIXTURES / "propostas_sc_pagina_1.json").read_text(encoding="utf-8")
)
REGISTROS_REAIS: list[dict[str, Any]] = PAGINA_REAL["data"]
ERRO_400_REAL = (FIXTURES / "erro_400_tamanho_pagina.json").read_text(encoding="utf-8")

Manipulador = Callable[[httpx.Request], httpx.Response]


class Esperas:
    """Substitui o time.sleep: anota quanto o cliente esperaria, sem esperar de verdade."""

    def __init__(self) -> None:
        self.segundos: list[float] = []

    def __call__(self, segundos: float) -> None:
        self.segundos.append(segundos)


def criar(manipulador: Manipulador, **opcoes: Any) -> tuple[ClientePNCP, Esperas]:
    esperas = Esperas()
    http = criar_cliente_http(transport=httpx.MockTransport(manipulador))
    return ClientePNCP(http, dormir=esperas, **opcoes), esperas


def pagina(registros: list[dict[str, Any]], *, numero: int, restantes: int) -> dict[str, Any]:
    return {
        "data": registros,
        "totalRegistros": len(registros) * (numero + restantes),
        "totalPaginas": numero + restantes,
        "numeroPagina": numero,
        "paginasRestantes": restantes,
        "empty": not registros,
    }


def em_sequencia(*respostas: httpx.Response | Exception) -> tuple[Manipulador, list[httpx.Request]]:
    """Manipulador que devolve (ou lança) as respostas na ordem e registra os pedidos."""
    pedidos: list[httpx.Request] = []
    fila = list(respostas)

    def manipulador(pedido: httpx.Request) -> httpx.Response:
        pedidos.append(pedido)
        proxima = fila.pop(0)
        if isinstance(proxima, Exception):
            raise proxima
        return proxima

    return manipulador, pedidos


def ok(corpo: dict[str, Any]) -> httpx.Response:
    return httpx.Response(200, json=corpo)


# --- Uma página -----------------------------------------------------------------------------


def test_envia_os_parametros_que_a_api_espera() -> None:
    manipulador, pedidos = em_sequencia(ok(PAGINA_REAL))
    cliente, _ = criar(manipulador)

    cliente.buscar_pagina_propostas(uf="SC", pagina=3)

    pedido = pedidos[0]
    assert pedido.url.path == "/api/consulta/v1/contratacoes/proposta"
    assert dict(pedido.url.params) == {
        "dataFinal": "99991231",
        "uf": "SC",
        "pagina": "3",
        "tamanhoPagina": "50",
    }
    assert pedido.headers["User-Agent"] == USER_AGENT


def test_le_uma_pagina_real_da_api() -> None:
    manipulador, _ = em_sequencia(ok(PAGINA_REAL))
    cliente, _ = criar(manipulador)

    resultado = cliente.buscar_pagina_propostas(uf="SC", pagina=1)

    assert resultado is not None
    assert len(resultado.registros) == 10
    assert resultado.numero_pagina == 1
    assert resultado.paginas_restantes == PAGINA_REAL["paginasRestantes"]


def test_resposta_204_sem_conteudo_vira_none() -> None:
    # A API responde 204, sem corpo, depois da última página ou quando o filtro não acha nada.
    manipulador, _ = em_sequencia(httpx.Response(204))
    cliente, _ = criar(manipulador)

    assert cliente.buscar_pagina_propostas(uf="SC", pagina=999) is None


@pytest.mark.parametrize("tamanho", [9, 51])
def test_recusa_tamanho_de_pagina_fora_do_limite_sem_chamar_a_api(tamanho: int) -> None:
    manipulador, pedidos = em_sequencia()
    cliente, _ = criar(manipulador)

    with pytest.raises(ValueError, match="de 10 a 50"):
        cliente.buscar_pagina_propostas(uf="SC", pagina=1, tamanho_pagina=tamanho)
    assert pedidos == []


@pytest.mark.parametrize("uf", ["sc", "SCC", ""])
def test_recusa_uf_invalida(uf: str) -> None:
    manipulador, _ = em_sequencia()
    cliente, _ = criar(manipulador)

    with pytest.raises(ValueError, match="UF"):
        cliente.buscar_pagina_propostas(uf=uf, pagina=1)


def test_resposta_que_nao_e_json_gera_erro_claro() -> None:
    manipulador, _ = em_sequencia(httpx.Response(200, text="<html>manutenção</html>"))
    cliente, _ = criar(manipulador)

    with pytest.raises(ErroAPIPNCP, match="Resposta inesperada"):
        cliente.buscar_pagina_propostas(uf="SC", pagina=1)


def test_valor_em_dinheiro_nao_passa_por_float() -> None:
    registro = dict(REGISTROS_REAIS[0], valorTotalEstimado="__VALOR__")
    texto = json.dumps(pagina([registro], numero=1, restantes=0)).replace(
        '"__VALOR__"', "12345678901234567.89"
    )
    manipulador, _ = em_sequencia(
        httpx.Response(200, text=texto, headers={"content-type": "application/json"})
    )
    cliente, _ = criar(manipulador)

    resultado = cliente.listar_propostas_abertas()

    assert resultado.contratacoes[0].valor_total_estimado == Decimal("12345678901234567.89")


# --- Várias páginas -------------------------------------------------------------------------


def test_percorre_as_paginas_ate_a_ultima() -> None:
    manipulador, pedidos = em_sequencia(
        ok(pagina(REGISTROS_REAIS[:5], numero=1, restantes=1)),
        ok(pagina(REGISTROS_REAIS[5:], numero=2, restantes=0)),
    )
    cliente, esperas = criar(manipulador)

    resultado = cliente.listar_propostas_abertas()

    assert len(resultado.contratacoes) == 10
    assert resultado.paginas_lidas == 2
    assert [p.url.params["pagina"] for p in pedidos] == ["1", "2"]
    assert esperas.segundos == [3.0]  # pausa entre as páginas, para não estourar o limite da API


def test_para_quando_a_api_responde_204_antes_do_previsto() -> None:
    manipulador, _ = em_sequencia(
        ok(pagina(REGISTROS_REAIS[:5], numero=1, restantes=3)),
        httpx.Response(204),
    )
    cliente, _ = criar(manipulador)

    resultado = cliente.listar_propostas_abertas()

    assert len(resultado.contratacoes) == 5
    assert resultado.paginas_lidas == 1


def test_registro_repetido_entre_paginas_aparece_uma_vez_so() -> None:
    # A lista pode mudar enquanto paginamos, e um registro pode aparecer em duas páginas.
    manipulador, _ = em_sequencia(
        ok(pagina(REGISTROS_REAIS[:3], numero=1, restantes=1)),
        ok(pagina(REGISTROS_REAIS[2:5], numero=2, restantes=0)),
    )
    cliente, _ = criar(manipulador)

    resultado = cliente.listar_propostas_abertas()

    assert len(resultado.contratacoes) == 5


def test_guarda_a_resposta_original_de_cada_contratacao() -> None:
    manipulador, _ = em_sequencia(ok(pagina(REGISTROS_REAIS[:2], numero=1, restantes=0)))
    cliente, _ = criar(manipulador)

    resultado = cliente.listar_propostas_abertas()

    chave = REGISTROS_REAIS[0]["numeroControlePNCP"]
    assert set(resultado.brutos) == {c.numero_controle_pncp for c in resultado.contratacoes}
    assert resultado.brutos[chave]["objetoCompra"] == REGISTROS_REAIS[0]["objetoCompra"]


def test_registro_invalido_nao_derruba_a_coleta() -> None:
    sujo = {k: v for k, v in REGISTROS_REAIS[0].items() if k != "objetoCompra"}
    manipulador, _ = em_sequencia(ok(pagina([sujo, *REGISTROS_REAIS[1:]], numero=1, restantes=0)))
    cliente, _ = criar(manipulador)

    resultado = cliente.listar_propostas_abertas()

    assert len(resultado.contratacoes) == 9
    assert len(resultado.invalidos) == 1
    assert resultado.invalidos[0].numero_controle_pncp == REGISTROS_REAIS[0]["numeroControlePNCP"]
    assert "objetoCompra" in resultado.invalidos[0].erro


def test_limite_de_paginas_evita_loop_infinito() -> None:
    def sempre_tem_mais(pedido: httpx.Request) -> httpx.Response:
        numero = int(pedido.url.params["pagina"])
        return ok(pagina(REGISTROS_REAIS[:1], numero=numero, restantes=1))

    cliente, _ = criar(sempre_tem_mais, limite_paginas=3)

    with pytest.raises(ErroAPIPNCP, match="Mais de 3 páginas"):
        cliente.listar_propostas_abertas()


# --- Nova tentativa -------------------------------------------------------------------------


def test_tenta_de_novo_em_erro_temporario_do_servidor() -> None:
    manipulador, pedidos = em_sequencia(httpx.Response(503), httpx.Response(500), ok(PAGINA_REAL))
    cliente, esperas = criar(manipulador)

    resultado = cliente.buscar_pagina_propostas(uf="SC", pagina=1)

    assert resultado is not None
    assert len(pedidos) == 3
    assert esperas.segundos == [5.0, 10.0]  # espera exponencial


def test_respeita_o_retry_after_quando_a_api_limita_o_uso() -> None:
    manipulador, _ = em_sequencia(
        httpx.Response(429, headers={"Retry-After": "7"}), ok(PAGINA_REAL)
    )
    cliente, esperas = criar(manipulador)

    cliente.buscar_pagina_propostas(uf="SC", pagina=1)

    assert esperas.segundos == [7.0]


def test_tenta_de_novo_em_falha_de_rede() -> None:
    manipulador, _ = em_sequencia(httpx.ConnectError("sem conexão"), ok(PAGINA_REAL))
    cliente, esperas = criar(manipulador)

    resultado = cliente.buscar_pagina_propostas(uf="SC", pagina=1)

    assert resultado is not None
    assert esperas.segundos == [5.0]


def test_desiste_depois_do_maximo_de_tentativas() -> None:
    manipulador, pedidos = em_sequencia(*[httpx.Response(503)] * 3)
    cliente, esperas = criar(manipulador, max_tentativas=3)

    with pytest.raises(ErroAPIPNCP, match=r"HTTP 503.*3 tentativas"):
        cliente.buscar_pagina_propostas(uf="SC", pagina=1)
    assert len(pedidos) == 3
    assert esperas.segundos == [5.0, 10.0]


def test_por_padrao_espera_mais_de_dois_minutos_antes_de_desistir() -> None:
    # Em 18/11/2026, esperas somando 15 s não bastaram para o limite da API passar.
    manipulador, pedidos = em_sequencia(*[httpx.Response(429)] * 6)
    cliente, esperas = criar(manipulador)

    with pytest.raises(ErroAPIPNCP, match="HTTP 429"):
        cliente.buscar_pagina_propostas(uf="SC", pagina=1)
    assert len(pedidos) == 6
    assert esperas.segundos == [5.0, 10.0, 20.0, 40.0, 80.0]


def test_espera_tem_teto() -> None:
    manipulador, _ = em_sequencia(*[httpx.Response(503)] * 5)
    cliente, esperas = criar(manipulador, max_tentativas=5, espera_maxima=15.0)

    with pytest.raises(ErroAPIPNCP):
        cliente.buscar_pagina_propostas(uf="SC", pagina=1)
    assert esperas.segundos == [5.0, 10.0, 15.0, 15.0]


def test_erro_400_nao_e_repetido_e_mostra_a_mensagem_da_api() -> None:
    manipulador, pedidos = em_sequencia(
        httpx.Response(400, text=ERRO_400_REAL, headers={"content-type": "application/json"})
    )
    cliente, esperas = criar(manipulador)

    with pytest.raises(ErroAPIPNCP, match="must be greater than or equal to 10"):
        cliente.buscar_pagina_propostas(uf="SC", pagina=1)
    assert len(pedidos) == 1
    assert esperas.segundos == []
