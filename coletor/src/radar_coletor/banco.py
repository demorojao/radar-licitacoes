"""Gravação das contratações e do registro das coletas no Postgres, com SQL direto (ADR 0006)."""

import json
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from decimal import Decimal
from typing import Any, Literal

import psycopg
from psycopg.types.json import Jsonb

from radar_coletor.cliente import RegistroInvalido
from radar_coletor.modelos import Contratacao

type Conexao = psycopg.Connection[Any]

COLUNAS = (
    "numero_controle_pncp",
    "cnpj_orgao",
    "orgao_razao_social",
    "ano_compra",
    "sequencial_compra",
    "numero_compra",
    "processo",
    "objeto",
    "informacao_complementar",
    "modalidade_id",
    "modalidade_nome",
    "modo_disputa_nome",
    "situacao_id",
    "situacao_nome",
    "srp",
    "valor_total_estimado",
    "valor_total_homologado",
    "data_publicacao",
    "data_abertura_proposta",
    "data_encerramento_proposta",
    "data_atualizacao_pncp",
    "uf",
    "municipio_nome",
    "codigo_ibge",
    "unidade_nome",
    "link_sistema_origem",
    "payload",
)

# Upsert: insere se a chave não existe; se existe, atualiza tudo menos a primeira coleta.
# "xmax = 0" é verdadeiro só para linhas recém-inseridas: numa linha atualizada pelo
# ON CONFLICT, o Postgres preenche xmax. É o jeito de contar novas e atualizadas num comando só.
SQL_UPSERT = f"""
insert into contratacoes ({", ".join(COLUNAS)}, ultima_coleta_em)
values ({", ".join(f"%({coluna})s" for coluna in COLUNAS)}, now())
on conflict (numero_controle_pncp) do update set
    {", ".join(f"{coluna} = excluded.{coluna}" for coluna in COLUNAS[1:])},
    ultima_coleta_em = now()
returning (xmax = 0) as inserida
"""


@dataclass(frozen=True)
class ResultadoGravacao:
    novas: int
    atualizadas: int


def _json_com_decimal(dados: Any) -> str:
    # O payload é só referência: os valores exatos ficam nas colunas numeric.
    return json.dumps(dados, ensure_ascii=False, default=_converter_decimal)


def _converter_decimal(valor: object) -> float:
    if isinstance(valor, Decimal):
        return float(valor)
    raise TypeError(f"Tipo não suportado em JSON: {type(valor).__name__}")


def linha_da_contratacao(contratacao: Contratacao, bruto: Mapping[str, Any]) -> dict[str, Any]:
    """Converte uma contratação validada nos valores das colunas da tabela `contratacoes`."""
    return {
        "numero_controle_pncp": contratacao.numero_controle_pncp,
        "cnpj_orgao": contratacao.orgao_entidade.cnpj,
        "orgao_razao_social": contratacao.orgao_entidade.razao_social,
        "ano_compra": contratacao.ano_compra,
        "sequencial_compra": contratacao.sequencial_compra,
        "numero_compra": contratacao.numero_compra,
        "processo": contratacao.processo,
        "objeto": contratacao.objeto_compra,
        "informacao_complementar": contratacao.informacao_complementar,
        "modalidade_id": contratacao.modalidade_id,
        "modalidade_nome": contratacao.modalidade_nome,
        "modo_disputa_nome": contratacao.modo_disputa_nome,
        "situacao_id": contratacao.situacao_compra_id,
        "situacao_nome": contratacao.situacao_compra_nome,
        "srp": contratacao.srp,
        "valor_total_estimado": contratacao.valor_total_estimado,
        "valor_total_homologado": contratacao.valor_total_homologado,
        "data_publicacao": contratacao.data_publicacao_pncp,
        "data_abertura_proposta": contratacao.data_abertura_proposta,
        "data_encerramento_proposta": contratacao.data_encerramento_proposta,
        "data_atualizacao_pncp": contratacao.data_atualizacao_global,
        "uf": contratacao.unidade_orgao.uf_sigla,
        "municipio_nome": contratacao.unidade_orgao.municipio_nome,
        "codigo_ibge": contratacao.unidade_orgao.codigo_ibge,
        "unidade_nome": contratacao.unidade_orgao.nome_unidade,
        "link_sistema_origem": contratacao.link_sistema_origem,
        "payload": Jsonb(dict(bruto), dumps=_json_com_decimal),
    }


def gravar_contratacoes(
    conexao: Conexao,
    contratacoes: Sequence[Contratacao],
    brutos: Mapping[str, Mapping[str, Any]],
) -> ResultadoGravacao:
    """Grava todas as contratações numa transação só: ou entram todas, ou nenhuma."""
    if not contratacoes:
        return ResultadoGravacao(novas=0, atualizadas=0)

    linhas = [linha_da_contratacao(c, brutos[c.numero_controle_pncp]) for c in contratacoes]
    novas = 0
    with conexao.transaction(), conexao.cursor() as cursor:
        cursor.executemany(SQL_UPSERT, linhas, returning=True)
        for _ in cursor.results():
            linha = cursor.fetchone()
            if linha is not None and linha[0]:
                novas += 1
    return ResultadoGravacao(novas=novas, atualizadas=len(linhas) - novas)


def iniciar_coleta(conexao: Conexao) -> int:
    """Abre o registro de uma coleta com status 'em_andamento' e devolve o id."""
    linha = conexao.execute("insert into coletas default values returning id").fetchone()
    if linha is None:  # não acontece: insert ... returning sempre devolve uma linha
        raise RuntimeError("O banco não devolveu o id da coleta")
    return int(linha[0])


def finalizar_coleta(
    conexao: Conexao,
    coleta_id: int,
    *,
    status: Literal["sucesso", "falha"],
    paginas_lidas: int | None = None,
    registros_validos: int | None = None,
    invalidos: Sequence[RegistroInvalido] = (),
    gravacao: ResultadoGravacao | None = None,
    erro: str | None = None,
) -> None:
    """Fecha o registro da coleta com o resultado."""
    conexao.execute(
        """
        update coletas set
            terminada_em = now(),
            status = %(status)s,
            paginas_lidas = %(paginas_lidas)s,
            registros_validos = %(registros_validos)s,
            registros_invalidos = %(registros_invalidos)s,
            invalidos = %(invalidos)s,
            novas = %(novas)s,
            atualizadas = %(atualizadas)s,
            erro = %(erro)s
        where id = %(id)s
        """,
        {
            "id": coleta_id,
            "status": status,
            "paginas_lidas": paginas_lidas,
            "registros_validos": registros_validos,
            "registros_invalidos": len(invalidos),
            "invalidos": Jsonb(
                [{"chave": i.numero_controle_pncp, "erro": i.erro} for i in invalidos]
            ),
            "novas": gravacao.novas if gravacao else None,
            "atualizadas": gravacao.atualizadas if gravacao else None,
            "erro": erro,
        },
    )
