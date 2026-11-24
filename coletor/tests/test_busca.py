"""Testes de integração da busca do site: buscar_contratacoes e opcoes_de_filtro."""

from typing import Any

import pytest
from apoio import Conexao, buscar, chaves, nova

pytestmark = pytest.mark.integracao

JOINVILLE = "4209102"
TAIO = "4217808"


def test_busca_ignora_acento_e_plural(conexao: Conexao) -> None:
    chave = nova(conexao, 1, objeto="Aquisição de produtos de higienização")
    nova(conexao, 2, objeto="Aquisição de cadeiras")

    assert chaves(buscar(conexao, p_texto="higienizacao")) == [chave]
    assert chaves(buscar(conexao, p_texto="produto")) == [chave]


def test_busca_pesa_mais_o_objeto_que_o_orgao(conexao: Conexao) -> None:
    no_orgao = nova(
        conexao,
        1,
        dias=2,
        objeto="Aquisição de cadeiras",
        orgao_razao_social="SECRETARIA DE LIMPEZA PUBLICA",
    )
    no_objeto = nova(conexao, 2, dias=20, objeto="Serviço de limpeza urbana")

    assert chaves(buscar(conexao, p_texto="limpeza")) == [no_objeto, no_orgao]


def test_so_aparecem_abertas_e_divulgadas(conexao: Conexao) -> None:
    for numero, (situacao_id, situacao_nome) in enumerate(
        [(2, "Revogada"), (3, "Anulada"), (4, "Suspensa")], start=1
    ):
        nova(conexao, numero, situacao_id=situacao_id, situacao_nome=situacao_nome)
    nova(conexao, 4, dias=-1)
    aberta = nova(conexao, 5)

    assert chaves(buscar(conexao)) == [aberta]


def test_filtros_sozinhos_e_combinados(conexao: Conexao) -> None:
    joinville: dict[str, Any] = {"codigo_ibge": JOINVILLE, "municipio_nome": "Joinville"}
    r1 = nova(conexao, 1, dias=3, modalidade_id=6, **joinville)
    r2 = nova(conexao, 2, dias=10, **joinville)
    r3 = nova(conexao, 3, dias=4, codigo_ibge=TAIO, modalidade_id=6)

    assert chaves(buscar(conexao, p_codigo_ibge=JOINVILLE)) == [r1, r2]
    assert chaves(buscar(conexao, p_modalidade_id=6)) == [r1, r3]
    assert chaves(buscar(conexao, p_prazo_dias=7)) == [r1, r3]
    combinados = buscar(conexao, p_codigo_ibge=JOINVILLE, p_modalidade_id=6, p_prazo_dias=7)
    assert chaves(combinados) == [r1]


def test_sem_texto_ordena_pelo_prazo_mais_proximo(conexao: Conexao) -> None:
    dez = nova(conexao, 1, dias=10)
    tres = nova(conexao, 2, dias=3)
    cinco = nova(conexao, 3, dias=5)

    assert chaves(buscar(conexao)) == [tres, cinco, dez]


def test_paginacao_total_e_pagina_alem_da_ultima(conexao: Conexao) -> None:
    for numero in range(1, 26):
        nova(conexao, numero, dias=numero)

    primeira = buscar(conexao)
    assert len(primeira) == 20
    assert {(linha["total"], linha["pagina"]) for linha in primeira} == {(25, 1)}

    segunda = buscar(conexao, p_pagina=2)
    assert len(segunda) == 5
    assert {(linha["total"], linha["pagina"]) for linha in segunda} == {(25, 2)}

    assert buscar(conexao, p_pagina=9) == segunda
    assert buscar(conexao, p_pagina=0) == primeira


@pytest.mark.parametrize("texto", ["de", "   ", "!!!"])
def test_texto_sem_termos_lista_tudo(conexao: Conexao, texto: str) -> None:
    nova(conexao, 1, dias=3)
    nova(conexao, 2, dias=5)

    assert chaves(buscar(conexao, p_texto=texto)) == chaves(buscar(conexao))
    assert len(buscar(conexao, p_texto=texto)) == 2


@pytest.mark.parametrize(
    "texto", ['"limpeza', "limpeza OR -luva", "'; drop table contratacoes; --", "a & b | !c"]
)
def test_texto_com_sintaxe_estranha_nao_quebra(conexao: Conexao, texto: str) -> None:
    nova(conexao, 1, objeto="Serviço de limpeza")

    buscar(conexao, p_texto=texto)

    assert conexao.execute("select count(*) from contratacoes").fetchone() == (1,)


def test_valor_vem_como_texto_exato(conexao: Conexao) -> None:
    nova(conexao, 1, valor_total_estimado="2297628657.83")

    assert buscar(conexao)[0]["valor_total_estimado"] == "2297628657.83"


def test_anon_executa_as_funcoes_e_o_rls_vale(conexao: Conexao) -> None:
    nova(conexao, 1)
    nova(conexao, 2)

    with conexao.transaction():
        conexao.execute("set local role anon")
        linhas = buscar(conexao)
        opcoes = conexao.execute("select * from public.opcoes_de_filtro()").fetchall()

    assert len(linhas) == 2
    assert opcoes


def test_opcoes_de_filtro_contam_so_abertas(conexao: Conexao) -> None:
    joinville: dict[str, Any] = {"codigo_ibge": JOINVILLE, "municipio_nome": "Joinville"}
    pregao: dict[str, Any] = {"modalidade_id": 6, "modalidade_nome": "Pregão - Eletrônico"}
    nova(conexao, 1, **joinville, **pregao)
    nova(conexao, 2, **joinville, **pregao)
    nova(conexao, 3, **joinville, **pregao, situacao_id=2, situacao_nome="Revogada")
    nova(conexao, 4, dias=-1, **joinville, **pregao)

    opcoes = conexao.execute("select * from public.opcoes_de_filtro()").fetchall()

    assert opcoes == [
        ("modalidade", "6", "Pregão - Eletrônico", 2),
        ("municipio", JOINVILLE, "Joinville", 2),
    ]


@pytest.mark.parametrize(
    ("no_banco", "buscado"),
    [
        ("Contratação de empresa de limpeza", "contratações"),
        ("CONTRATAÇÕES DE SERVIÇOS GERAIS", "contratacao"),
        ("Aquisição de copos descartáveis", "descartavel"),
        ("Compra de material de escritório", "materiais"),
        ("Aquisição de itens de informática", "item"),
        ("Fornecimento de lençóis hospitalares", "lencol"),
        ("Aquisição de pneus para a frota", "pneu"),
        ("Execução de obras de drenagem", "obra"),
        ("Compra de um pneu", "pneus"),
    ],
)
def test_plural_e_singular_com_acento_se_encontram(
    conexao: Conexao, no_banco: str, buscado: str
) -> None:
    chave = nova(conexao, 1, objeto=no_banco)

    assert chaves(buscar(conexao, p_texto=buscado)) == [chave]
