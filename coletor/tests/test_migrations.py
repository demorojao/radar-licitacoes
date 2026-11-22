"""Testes de integração da migration: estrutura, regras do banco e RLS."""

from typing import Any

import psycopg
import pytest
from psycopg.types.json import Jsonb

pytestmark = pytest.mark.integracao

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


def test_grava_e_le_uma_contratacao(conexao: Conexao) -> None:
    inserir(conexao, valor_total_estimado="6313500.00")

    linha = conexao.execute(
        "select valor_total_estimado::text, primeira_coleta_em = ultima_coleta_em from contratacoes"
    ).fetchone()

    assert linha == ("6313500.00", True)


@pytest.mark.parametrize(
    ("coluna", "valor"),
    [
        ("numero_controle_pncp", "sem-formato"),
        ("cnpj_orgao", "123"),
        ("uf", "sc"),
        ("codigo_ibge", "42178"),
    ],
)
def test_banco_recusa_valor_fora_do_formato(conexao: Conexao, coluna: str, valor: str) -> None:
    with pytest.raises(psycopg.errors.CheckViolation):
        inserir(conexao, **{coluna: valor})


def test_chave_repetida_e_recusada(conexao: Conexao) -> None:
    inserir(conexao)

    with pytest.raises(psycopg.errors.UniqueViolation):
        inserir(conexao)


def test_status_da_coleta_so_aceita_valores_conhecidos(conexao: Conexao) -> None:
    with pytest.raises(psycopg.errors.CheckViolation):
        conexao.execute("insert into coletas (status) values ('talvez')")


# --- RLS: o público só lê -------------------------------------------------------------------


@pytest.mark.parametrize("tabela", ["contratacoes", "coletas"])
def test_publico_consegue_ler(conexao: Conexao, tabela: str) -> None:
    inserir(conexao)
    conexao.execute("insert into coletas default values")

    with conexao.transaction():
        conexao.execute("set local role anon")
        total = conexao.execute(f"select count(*) from {tabela}").fetchone()

    assert total == (1,)


def test_publico_nao_consegue_inserir(conexao: Conexao) -> None:
    # "new row violates row-level security policy" (SQLSTATE 42501)
    with pytest.raises(psycopg.errors.InsufficientPrivilege), conexao.transaction():
        conexao.execute("set local role anon")
        inserir(conexao)


def test_publico_nao_consegue_criar_coleta(conexao: Conexao) -> None:
    with pytest.raises(psycopg.errors.InsufficientPrivilege), conexao.transaction():
        conexao.execute("set local role anon")
        conexao.execute("insert into coletas default values")


@pytest.mark.parametrize(
    "comando",
    [
        "update contratacoes set objeto = 'alterado'",
        "delete from contratacoes",
    ],
)
def test_publico_nao_consegue_alterar_nem_apagar(conexao: Conexao, comando: str) -> None:
    inserir(conexao)

    with conexao.transaction():
        conexao.execute("set local role anon")
        # Sem política de escrita, o RLS esconde as linhas: o comando não afeta nenhuma.
        afetadas = conexao.execute(comando).rowcount

    assert afetadas == 0
    assert conexao.execute("select objeto from contratacoes").fetchone() == (
        CONTRATACAO_MINIMA["objeto"],
    )
