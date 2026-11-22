"""Banco de teste para os testes de integração (marcados com @pytest.mark.integracao).

Precisa de um Postgres descartável em TEST_DATABASE_URL. O CI sobe um; na máquina de
desenvolvimento, sem Docker, esses testes são pulados. Com EXIGIR_BANCO_DE_TESTE=1 (no CI), a
falta do banco é erro, para o CI nunca passar com os testes de banco pulados.
"""

import os
from collections.abc import Iterator
from pathlib import Path

import psycopg
import pytest

RAIZ_DO_REPOSITORIO = Path(__file__).resolve().parents[2]
MIGRATIONS = RAIZ_DO_REPOSITORIO / "supabase" / "migrations"
SIMULAR_SUPABASE = Path(__file__).parent / "sql" / "simular_supabase.sql"


@pytest.fixture(scope="session")
def banco_de_teste() -> Iterator[str]:
    """Aplica do zero os papéis do Supabase e todas as migrations, uma vez por sessão de testes."""
    url = os.environ.get("TEST_DATABASE_URL")
    if not url:
        motivo = "TEST_DATABASE_URL não definido: testes de banco rodam no CI"
        if os.environ.get("EXIGIR_BANCO_DE_TESTE") == "1":
            pytest.fail(motivo)
        pytest.skip(motivo)

    with psycopg.connect(url, autocommit=True) as conexao:
        conexao.execute("drop schema public cascade")
        conexao.execute("create schema public")
        # Sem parâmetros, o psycopg usa o protocolo simples, que aceita vários comandos.
        conexao.execute(SIMULAR_SUPABASE.read_text(encoding="utf-8"))
        for migration in sorted(MIGRATIONS.glob("*.sql")):
            conexao.execute(migration.read_text(encoding="utf-8"))
    yield url


@pytest.fixture
def conexao(banco_de_teste: str) -> Iterator[psycopg.Connection[tuple[object, ...]]]:
    """Conexão como dono das tabelas (como o coletor), com as tabelas vazias a cada teste."""
    with psycopg.connect(banco_de_teste, autocommit=True) as conexao:
        conexao.execute("truncate public.contratacoes, public.coletas restart identity")
        yield conexao
