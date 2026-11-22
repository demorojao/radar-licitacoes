"""Testes da coleta completa: API simulada (MockTransport) e Postgres de teste (CI)."""

import json
from pathlib import Path
from typing import Any

import httpx
import psycopg
import pytest

from radar_coletor.__main__ import main
from radar_coletor.cliente import ClientePNCP, criar_cliente_http
from radar_coletor.coleta import executar_coleta

FIXTURES = Path(__file__).parent / "fixtures"
PAGINA_REAL: dict[str, Any] = json.loads(
    (FIXTURES / "propostas_sc_pagina_1.json").read_text(encoding="utf-8")
)
ULTIMA_PAGINA = {**PAGINA_REAL, "paginasRestantes": 0}

Conexao = psycopg.Connection[tuple[Any, ...]]


def cliente_que_responde(resposta: httpx.Response) -> ClientePNCP:
    http = criar_cliente_http(transport=httpx.MockTransport(lambda _pedido: resposta))
    return ClientePNCP(http, max_tentativas=1, dormir=lambda _segundos: None)


def test_sem_database_url_explica_o_que_falta(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    monkeypatch.delenv("DATABASE_URL", raising=False)

    assert main() == 2
    assert "DATABASE_URL" in capsys.readouterr().err


@pytest.mark.integracao
def test_coleta_bem_sucedida_grava_e_registra(conexao: Conexao) -> None:
    cliente = cliente_que_responde(httpx.Response(200, json=ULTIMA_PAGINA))

    assert executar_coleta(conexao, cliente) is True

    assert conexao.execute("select count(*) from contratacoes").fetchone() == (10,)
    assert conexao.execute(
        "select status, paginas_lidas, registros_validos, novas, atualizadas, erro from coletas"
    ).fetchone() == ("sucesso", 1, 10, 10, 0, None)


@pytest.mark.integracao
def test_segunda_coleta_so_atualiza(conexao: Conexao) -> None:
    executar_coleta(conexao, cliente_que_responde(httpx.Response(200, json=ULTIMA_PAGINA)))

    executar_coleta(conexao, cliente_que_responde(httpx.Response(200, json=ULTIMA_PAGINA)))

    assert conexao.execute("select count(*) from contratacoes").fetchone() == (10,)
    assert conexao.execute("select novas, atualizadas from coletas where id = 2").fetchone() == (
        0,
        10,
    )


@pytest.mark.integracao
def test_falha_da_api_fica_registrada(conexao: Conexao) -> None:
    cliente = cliente_que_responde(httpx.Response(503))

    assert executar_coleta(conexao, cliente) is False

    linha = conexao.execute("select status, erro from coletas").fetchone()
    assert linha is not None
    assert linha[0] == "falha"
    assert "HTTP 503" in linha[1]
    assert conexao.execute("select count(*) from contratacoes").fetchone() == (0,)


@pytest.mark.integracao
def test_coleta_sem_nenhuma_contratacao_conta_como_falha(conexao: Conexao) -> None:
    cliente = cliente_que_responde(httpx.Response(204))

    assert executar_coleta(conexao, cliente) is False

    linha = conexao.execute("select status, erro from coletas").fetchone()
    assert linha is not None
    assert linha[0] == "falha"
    assert "ColetaVazia" in linha[1]
