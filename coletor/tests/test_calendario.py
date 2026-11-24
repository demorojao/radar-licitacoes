"""Testes de integração do calendário de encerramento (ADR 0010).

Todo "dia" é no horário de Brasília (UTC-3, sem horário de verão desde 2019). As datas ficam em
dezembro do ano que vem, para estarem sempre no futuro.
"""

from datetime import UTC, date, datetime, timedelta, timezone
from typing import Any

import pytest
from apoio import Conexao, buscar, chaves, inserir

pytestmark = pytest.mark.integracao

BRASILIA = timezone(timedelta(hours=-3))
ANO = datetime.now(UTC).year + 1
JOINVILLE = "4209102"


def dia(numero: int) -> date:
    return date(ANO, 12, numero)


def em(conexao: Conexao, numero: int, quando: datetime, **alteracoes: Any) -> str:
    """Insere uma contratação aberta que encerra em `quando` e devolve a chave."""
    chave = f"11433441000101-1-{numero:06d}/2026"
    inserir(
        conexao,
        numero_controle_pncp=chave,
        sequencial_compra=numero,
        data_encerramento_proposta=quando,
        **alteracoes,
    )
    return chave


def as_(dia_do_mes: int, hora: int, minuto: int = 0) -> datetime:
    """Um horário de Brasília em dezembro do ano que vem."""
    return datetime(ANO, 12, dia_do_mes, hora, minuto, tzinfo=BRASILIA)


def encerramentos(conexao: Conexao, **parametros: Any) -> list[tuple[date, int]]:
    argumentos = ", ".join(f"{nome} => %({nome})s" for nome in parametros)
    linhas = conexao.execute(
        f"select dia, quantidade from public.encerramentos_por_dia({argumentos})", parametros
    ).fetchall()
    return [(linha[0], linha[1]) for linha in linhas]


def test_a_partir_do_dia_respeita_brasilia(conexao: Conexao) -> None:
    em(conexao, 1, as_(14, 23, 30))  # 02:30 do dia 15 em UTC, mas dia 14 em Brasília
    dia_15 = em(conexao, 2, as_(15, 0, 30))

    assert chaves(buscar(conexao, p_encerra_a_partir=dia(15))) == [dia_15]


def test_com_data_a_ordem_e_pelo_prazo_mesmo_com_texto(conexao: Conexao) -> None:
    no_objeto = em(conexao, 1, as_(20, 10), objeto="Serviço de limpeza urbana")
    no_orgao = em(
        conexao,
        2,
        as_(16, 10),
        objeto="Aquisição de cadeiras",
        orgao_razao_social="SECRETARIA DE LIMPEZA PUBLICA",
    )

    resultado = buscar(conexao, p_texto="limpeza", p_encerra_a_partir=dia(15))

    assert chaves(resultado) == [no_orgao, no_objeto]


def test_sem_data_a_ordem_continua_a_de_hoje(conexao: Conexao) -> None:
    no_objeto = em(conexao, 1, as_(20, 10), objeto="Serviço de limpeza urbana")
    no_orgao = em(
        conexao,
        2,
        as_(16, 10),
        objeto="Aquisição de cadeiras",
        orgao_razao_social="SECRETARIA DE LIMPEZA PUBLICA",
    )

    assert chaves(buscar(conexao, p_texto="limpeza")) == [no_objeto, no_orgao]


def test_encerramentos_por_dia_conta_em_brasilia(conexao: Conexao) -> None:
    em(conexao, 1, as_(15, 9))
    em(conexao, 2, as_(15, 23, 30))
    em(conexao, 3, as_(16, 9))

    assert encerramentos(conexao, p_mes=dia(1)) == [(dia(15), 2), (dia(16), 1)]


def test_encerramentos_por_dia_respeita_texto_sinonimo_e_municipio(conexao: Conexao) -> None:
    joinville: dict[str, Any] = {"codigo_ibge": JOINVILLE, "municipio_nome": "Joinville"}
    em(conexao, 1, as_(15, 9), objeto="Aquisição de medicamentos", **joinville)
    em(conexao, 2, as_(15, 10), objeto="Aquisição de cadeiras", **joinville)
    em(conexao, 3, as_(16, 9), objeto="Aquisição de medicamentos")

    assert encerramentos(conexao, p_texto="remédio", p_mes=dia(1)) == [(dia(15), 1), (dia(16), 1)]
    assert encerramentos(conexao, p_texto="remédio", p_codigo_ibge=JOINVILLE, p_mes=dia(1)) == [
        (dia(15), 1)
    ]


def test_encerramentos_por_dia_ignora_revogadas_e_outros_meses(conexao: Conexao) -> None:
    em(conexao, 1, as_(15, 9))
    em(conexao, 2, as_(15, 9), situacao_id=2, situacao_nome="Revogada")
    em(conexao, 3, datetime(ANO + 1, 1, 2, 9, tzinfo=BRASILIA))
    em(conexao, 4, datetime.now(UTC) - timedelta(days=1))

    assert encerramentos(conexao, p_mes=dia(20)) == [(dia(15), 1)]


def test_contagem_bate_com_a_lista(conexao: Conexao) -> None:
    for numero, (dia_do_mes, hora) in enumerate([(10, 9), (15, 1), (15, 22), (20, 12)], start=1):
        em(conexao, numero, as_(dia_do_mes, hora))

    do_mes = encerramentos(conexao, p_mes=dia(1))
    a_partir_de_15 = sum(quantidade for quando, quantidade in do_mes if quando >= dia(15))
    lista = buscar(conexao, p_encerra_a_partir=dia(15))

    assert a_partir_de_15 == 3
    assert {linha["total"] for linha in lista} == {a_partir_de_15}


def test_prazo_dias_continua_funcionando(conexao: Conexao) -> None:
    perto = em(conexao, 1, datetime.now(UTC) + timedelta(days=3))
    em(conexao, 2, datetime.now(UTC) + timedelta(days=10))

    assert chaves(buscar(conexao, p_prazo_dias=7)) == [perto]


def test_anon_executa_encerramentos_por_dia(conexao: Conexao) -> None:
    em(conexao, 1, as_(15, 9))

    with conexao.transaction():
        conexao.execute("set local role anon")
        resultado = encerramentos(conexao, p_mes=dia(1))

    assert resultado == [(dia(15), 1)]
