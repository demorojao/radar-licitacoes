"""Testes de integração da ordenação e da data de publicação.

Plano: docs/planos/2026-11-24-publicacao-e-ordem.md.
"""

from datetime import UTC, datetime
from typing import Any

import pytest
from apoio import Conexao, buscar, chaves, nova

pytestmark = pytest.mark.integracao


def publicada(dia: int) -> datetime:
    return datetime(2026, 11, dia, 12, tzinfo=UTC)


def tres(conexao: Conexao) -> tuple[str, str, str]:
    """Três licitações: publicada dia 20 (prazo longo), dia 10 (prazo curto) e sem data."""
    recente = nova(conexao, 1, dias=30, data_publicacao=publicada(20))
    antiga = nova(conexao, 2, dias=5, data_publicacao=publicada(10))
    sem_data = nova(conexao, 3, dias=10, data_publicacao=None)
    return recente, antiga, sem_data


def test_publicadas_recentemente_primeiro(conexao: Conexao) -> None:
    recente, antiga, sem_data = tres(conexao)

    assert chaves(buscar(conexao, p_ordem="recentes")) == [recente, antiga, sem_data]


def test_publicadas_ha_mais_tempo_primeiro(conexao: Conexao) -> None:
    recente, antiga, sem_data = tres(conexao)

    assert chaves(buscar(conexao, p_ordem="antigas")) == [antiga, recente, sem_data]


def test_prazo_mais_proximo_mesmo_com_texto(conexao: Conexao) -> None:
    no_objeto = nova(conexao, 1, dias=20, objeto="Serviço de limpeza urbana")
    no_orgao = nova(
        conexao,
        2,
        dias=3,
        objeto="Aquisição de cadeiras",
        orgao_razao_social="SECRETARIA DE LIMPEZA PUBLICA",
    )

    assert chaves(buscar(conexao, p_texto="limpeza", p_ordem="prazo")) == [no_orgao, no_objeto]


def test_mais_relevantes_mesmo_com_data_no_calendario(conexao: Conexao) -> None:
    no_objeto = nova(conexao, 1, dias=20, objeto="Serviço de limpeza urbana")
    no_orgao = nova(
        conexao,
        2,
        dias=3,
        objeto="Aquisição de cadeiras",
        orgao_razao_social="SECRETARIA DE LIMPEZA PUBLICA",
    )
    hoje = datetime.now(UTC).date()

    resultado = buscar(conexao, p_texto="limpeza", p_ordem="relevancia", p_encerra_a_partir=hoje)

    assert chaves(resultado) == [no_objeto, no_orgao]


@pytest.mark.parametrize("ordem", [None, "qualquer coisa", ""])
def test_sem_ordem_ou_ordem_desconhecida_vale_o_padrao(conexao: Conexao, ordem: Any) -> None:
    recente, antiga, sem_data = tres(conexao)

    # Sem texto, o padrão é o prazo mais próximo.
    assert chaves(buscar(conexao, p_ordem=ordem)) == [antiga, sem_data, recente]


def test_devolve_a_data_de_publicacao(conexao: Conexao) -> None:
    nova(conexao, 1, data_publicacao=publicada(25))
    nova(conexao, 2, dias=20, data_publicacao=None)

    datas = [linha["data_publicacao"] for linha in buscar(conexao)]

    assert datas == [publicada(25), None]
