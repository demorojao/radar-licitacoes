"""Testes da gravação no banco. Os de integração precisam do Postgres de teste (CI)."""

import json
from decimal import Decimal
from pathlib import Path
from typing import Any

import psycopg
import pytest

from radar_coletor.banco import (
    COLUNAS,
    ResultadoGravacao,
    finalizar_coleta,
    gravar_contratacoes,
    iniciar_coleta,
    linha_da_contratacao,
)
from radar_coletor.cliente import RegistroInvalido
from radar_coletor.modelos import Contratacao

FIXTURES = Path(__file__).parent / "fixtures"
PAGINA: dict[str, Any] = json.loads(
    (FIXTURES / "propostas_sc_pagina_1.json").read_text(encoding="utf-8"), parse_float=Decimal
)
BRUTOS: list[dict[str, Any]] = PAGINA["data"]
CONTRATACOES = [Contratacao.model_validate(b) for b in BRUTOS]
BRUTOS_POR_CHAVE = {b["numeroControlePNCP"]: b for b in BRUTOS}

Conexao = psycopg.Connection[tuple[Any, ...]]


# --- Unidade --------------------------------------------------------------------------------


def test_linha_tem_exatamente_as_colunas_da_tabela() -> None:
    linha = linha_da_contratacao(CONTRATACOES[0], BRUTOS[0])

    assert tuple(linha) == COLUNAS


def test_linha_converte_os_campos_de_um_registro_real() -> None:
    linha = linha_da_contratacao(CONTRATACOES[0], BRUTOS[0])

    assert linha["numero_controle_pncp"] == "11433441000101-1-000001/2023"
    assert linha["cnpj_orgao"] == "11433441000101"
    assert linha["municipio_nome"] == "Taió"
    assert linha["situacao_nome"] == "Divulgada no PNCP"
    assert linha["valor_total_estimado"] == Decimal("6313500.00")
    assert linha["data_encerramento_proposta"].isoformat() == "2027-06-18T17:30:00-03:00"


def test_payload_guarda_a_resposta_original() -> None:
    linha = linha_da_contratacao(CONTRATACOES[0], BRUTOS[0])

    assert linha["payload"].obj["numeroControlePNCP"] == BRUTOS[0]["numeroControlePNCP"]


# --- Integração -----------------------------------------------------------------------------


@pytest.mark.integracao
def test_primeira_gravacao_conta_todas_como_novas(conexao: Conexao) -> None:
    resultado = gravar_contratacoes(conexao, CONTRATACOES, BRUTOS_POR_CHAVE)

    assert resultado == ResultadoGravacao(novas=10, atualizadas=0)
    assert conexao.execute("select count(*) from contratacoes").fetchone() == (10,)


@pytest.mark.integracao
def test_gravar_duas_vezes_nao_duplica(conexao: Conexao) -> None:
    gravar_contratacoes(conexao, CONTRATACOES, BRUTOS_POR_CHAVE)

    resultado = gravar_contratacoes(conexao, CONTRATACOES, BRUTOS_POR_CHAVE)

    assert resultado == ResultadoGravacao(novas=0, atualizadas=10)
    assert conexao.execute("select count(*) from contratacoes").fetchone() == (10,)


@pytest.mark.integracao
def test_atualiza_os_dados_e_mantem_a_primeira_coleta(conexao: Conexao) -> None:
    gravar_contratacoes(conexao, CONTRATACOES[:1], BRUTOS_POR_CHAVE)
    conexao.execute(
        "update contratacoes set primeira_coleta_em = now() - interval '1 day', "
        "ultima_coleta_em = now() - interval '1 day'"
    )
    revogada = CONTRATACOES[0].model_copy(update={"situacao_compra_nome": "Revogada"})

    gravar_contratacoes(conexao, [revogada], BRUTOS_POR_CHAVE)

    linha = conexao.execute(
        "select situacao_nome, primeira_coleta_em < ultima_coleta_em from contratacoes"
    ).fetchone()
    assert linha == ("Revogada", True)


@pytest.mark.integracao
def test_valor_e_payload_chegam_intactos_no_banco(conexao: Conexao) -> None:
    gravar_contratacoes(conexao, CONTRATACOES[:1], BRUTOS_POR_CHAVE)

    linha = conexao.execute(
        "select valor_total_estimado, payload->>'objetoCompra' from contratacoes"
    ).fetchone()

    assert linha == (Decimal("6313500.00"), BRUTOS[0]["objetoCompra"])


@pytest.mark.integracao
def test_lista_vazia_nao_grava_nada(conexao: Conexao) -> None:
    assert gravar_contratacoes(conexao, [], {}) == ResultadoGravacao(novas=0, atualizadas=0)


@pytest.mark.integracao
def test_registra_o_inicio_e_o_fim_de_uma_coleta(conexao: Conexao) -> None:
    coleta_id = iniciar_coleta(conexao)
    finalizar_coleta(
        conexao,
        coleta_id,
        status="sucesso",
        paginas_lidas=55,
        registros_validos=2703,
        invalidos=[RegistroInvalido("x-1", "objetoCompra: Field required")],
        gravacao=ResultadoGravacao(novas=3, atualizadas=2700),
    )

    linha = conexao.execute(
        "select status, paginas_lidas, registros_validos, registros_invalidos, novas, "
        "atualizadas, invalidos->0->>'chave', terminada_em is not null from coletas"
    ).fetchone()
    assert linha == ("sucesso", 55, 2703, 1, 3, 2700, "x-1", True)


@pytest.mark.integracao
def test_coleta_nova_comeca_em_andamento(conexao: Conexao) -> None:
    coleta_id = iniciar_coleta(conexao)

    linha = conexao.execute("select status from coletas where id = %s", (coleta_id,)).fetchone()
    assert linha == ("em_andamento",)
