"""Apoio aos testes de banco: uma contratação mínima válida, como inseri-la e como buscar."""

from datetime import UTC, datetime, timedelta
from typing import Any

import psycopg
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb

Conexao = psycopg.Connection[tuple[Any, ...]]

CONTRATACAO_MINIMA: dict[str, Any] = {
    "numero_controle_pncp": "11433441000101-1-000001/2023",
    "cnpj_orgao": "11433441000101",
    "orgao_razao_social": "FUNDO MUNICIPAL DE SAUDE",
    "ano_compra": 2023,
    "sequencial_compra": 1,
    "objeto": "Credenciamento de serviços de saúde",
    "modalidade_id": 12,
    "modalidade_nome": "Credenciamento",
    "situacao_id": 1,
    "situacao_nome": "Divulgada no PNCP",
    "data_encerramento_proposta": "2027-06-18T17:30:00-03:00",
    "uf": "SC",
    "municipio_nome": "Taió",
    "codigo_ibge": "4217808",
    "payload": Jsonb({"numeroControlePNCP": "11433441000101-1-000001/2023"}),
}


def inserir(conexao: Conexao, **alteracoes: Any) -> None:
    linha = {**CONTRATACAO_MINIMA, **alteracoes}
    colunas = ", ".join(linha)
    marcadores = ", ".join(f"%({coluna})s" for coluna in linha)
    conexao.execute(f"insert into contratacoes ({colunas}) values ({marcadores})", linha)


def nova(conexao: Conexao, numero: int, *, dias: float = 10, **alteracoes: Any) -> str:
    """Insere uma contratação aberta que encerra daqui a `dias` dias e devolve a chave."""
    chave = f"11433441000101-1-{numero:06d}/2026"
    inserir(
        conexao,
        numero_controle_pncp=chave,
        sequencial_compra=numero,
        data_encerramento_proposta=datetime.now(UTC) + timedelta(days=dias),
        **alteracoes,
    )
    return chave


def buscar(conexao: Conexao, **parametros: Any) -> list[dict[str, Any]]:
    argumentos = ", ".join(f"{nome} => %({nome})s" for nome in parametros)
    with conexao.cursor(row_factory=dict_row) as cursor:
        return cursor.execute(
            f"select * from public.buscar_contratacoes({argumentos})", parametros
        ).fetchall()


def chaves(linhas: list[dict[str, Any]]) -> list[str]:
    return [linha["numero_controle_pncp"] for linha in linhas]
