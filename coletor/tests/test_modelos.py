"""Testes dos modelos com registros reais da API do PNCP (fixtures gravadas em 18/11/2026)."""

import json
from decimal import Decimal
from pathlib import Path
from typing import Any

import pytest
from pydantic import ValidationError

from radar_coletor.modelos import Contratacao, PaginaPNCP

FIXTURES = Path(__file__).parent / "fixtures"


def carregar(nome: str) -> Any:
    # parse_float=Decimal, como faz o cliente: valor em dinheiro nunca passa por float.
    return json.loads((FIXTURES / nome).read_text(encoding="utf-8"), parse_float=Decimal)


PAGINA: dict[str, Any] = carregar("propostas_sc_pagina_1.json")
CASOS: dict[str, dict[str, Any]] = carregar("propostas_sc_casos_especiais.json")
REGISTRO: dict[str, Any] = PAGINA["data"][0]


def test_le_o_envelope_de_paginacao() -> None:
    pagina = PaginaPNCP.model_validate(PAGINA)

    assert pagina.total_registros == 2704
    assert pagina.numero_pagina == 1
    assert pagina.paginas_restantes == 270
    assert len(pagina.registros) == 10


def test_todos_os_registros_da_pagina_real_sao_validos() -> None:
    for registro in PAGINA["data"]:
        Contratacao.model_validate(registro)


def test_converte_os_campos_de_um_registro_real() -> None:
    contratacao = Contratacao.model_validate(REGISTRO)

    assert contratacao.numero_controle_pncp == "11433441000101-1-000001/2023"
    assert contratacao.orgao_entidade.cnpj == "11433441000101"
    assert contratacao.orgao_entidade.razao_social == "FUNDO MUNICIPAL DE SAUDE"
    assert contratacao.unidade_orgao.municipio_nome == "Taió"
    assert contratacao.unidade_orgao.codigo_ibge == "4217808"
    assert contratacao.modalidade_nome == "Credenciamento"
    assert contratacao.valor_total_estimado == Decimal("6313500.00")
    assert contratacao.data_encerramento_proposta.isoformat() == "2027-06-18T17:30:00-03:00"


# --- Casos especiais encontrados nos 2.704 registros reais ----------------------------------


def test_aceita_prazo_depois_de_2099() -> None:
    contratacao = Contratacao.model_validate(CASOS["prazo_depois_de_2099"])

    assert contratacao.data_encerramento_proposta.year == 2100


def test_texto_vazio_vira_none() -> None:
    contratacao = Contratacao.model_validate(CASOS["textos_vazios"])

    assert contratacao.link_sistema_origem is None
    assert contratacao.informacao_complementar is None


def test_aceita_valor_estimado_zero() -> None:
    contratacao = Contratacao.model_validate(CASOS["valor_estimado_zero"])

    assert contratacao.valor_total_estimado == 0


def test_mantem_a_situacao_de_uma_licitacao_revogada() -> None:
    # O endpoint de propostas abertas também traz revogadas, suspensas e anuladas.
    contratacao = Contratacao.model_validate(CASOS["revogada"])

    assert contratacao.situacao_compra_nome == "Revogada"


def test_le_o_valor_homologado_quando_existe() -> None:
    contratacao = Contratacao.model_validate(CASOS["com_valor_homologado"])

    assert contratacao.valor_total_homologado == Decimal("225000.00")


def test_guarda_o_link_do_portal_externo() -> None:
    contratacao = Contratacao.model_validate(CASOS["portal_externo"])

    assert contratacao.objeto_compra.startswith("[LICITANET]")
    assert contratacao.link_sistema_origem == "https://licitanet.com.br/sessao/140558"


# --- Dados inválidos ------------------------------------------------------------------------


def test_ignora_campos_novos_da_api() -> None:
    Contratacao.model_validate({**REGISTRO, "campoNovoDaApi": 123})


def test_objeto_ausente_invalida_o_registro() -> None:
    sem_objeto = {k: v for k, v in REGISTRO.items() if k != "objetoCompra"}

    with pytest.raises(ValidationError, match="objetoCompra"):
        Contratacao.model_validate(sem_objeto)


@pytest.mark.parametrize(
    ("campo", "valor"),
    [
        ("objetoCompra", "   "),
        ("dataEncerramentoProposta", "31/12/2026"),
        ("dataEncerramentoProposta", 20261231),
        ("dataEncerramentoProposta", None),
        ("numeroControlePNCP", "sem-formato"),
    ],
)
def test_valor_invalido_em_campo_essencial_invalida_o_registro(campo: str, valor: object) -> None:
    with pytest.raises(ValidationError, match=campo):
        Contratacao.model_validate({**REGISTRO, campo: valor})


def test_cnpj_do_orgao_precisa_ter_14_digitos() -> None:
    orgao = {**REGISTRO["orgaoEntidade"], "cnpj": "123"}

    with pytest.raises(ValidationError, match="cnpj"):
        Contratacao.model_validate({**REGISTRO, "orgaoEntidade": orgao})
