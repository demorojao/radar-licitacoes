"""Testes de integração dos sinônimos da busca (docs/sinonimos.md, ADR 0009).

Usam a lista real, gravada pela migration: remédio → medicamento e carro → veículo, automóvel.
"""

from typing import Any

import psycopg
import pytest
from apoio import Conexao, buscar, chaves, nova

pytestmark = pytest.mark.integracao

JOINVILLE = "4209102"


def sinonimos_por_chave(linhas: list[dict[str, Any]]) -> dict[str, list[str]]:
    return {linha["numero_controle_pncp"]: linha["sinonimos_usados"] for linha in linhas}


def test_remedio_acha_medicamento_com_etiqueta(conexao: Conexao) -> None:
    chave = nova(conexao, 1, objeto="Aquisição de medicamentos")

    assert sinonimos_por_chave(buscar(conexao, p_texto="remédio")) == {chave: ["medicamento"]}


def test_quem_tem_a_palavra_digitada_vem_sem_etiqueta(conexao: Conexao) -> None:
    carro = nova(conexao, 1, objeto="Locação de carro")
    veiculo = nova(conexao, 2, objeto="Aquisição de veículo")

    assert sinonimos_por_chave(buscar(conexao, p_texto="carro")) == {
        carro: [],
        veiculo: ["veículo"],
    }


@pytest.mark.parametrize("texto", ["remédios", "remedio", "REMÉDIO"])
def test_plural_e_acento_no_termo_digitado(conexao: Conexao, texto: str) -> None:
    chave = nova(conexao, 1, objeto="Aquisição de medicamentos")

    assert chaves(buscar(conexao, p_texto=texto)) == [chave]


def test_radical_igual_sem_a_palavra_nao_entra(conexao: Conexao) -> None:
    # "medicamento" e "médico" têm o mesmo radical (medic). Sem a palavra escrita, não entra.
    nova(conexao, 1, objeto="Credenciamento de consultas médicas")

    assert buscar(conexao, p_texto="remédio") == []


def test_sinonimo_so_no_orgao_nao_entra(conexao: Conexao) -> None:
    nova(
        conexao,
        1,
        objeto="Aquisição de cadeiras",
        orgao_razao_social="CENTRO DE INFORMATICA E AUTOMACAO DO ESTADO",
    )

    assert buscar(conexao, p_texto="computador") == []


def test_cada_termo_precisa_da_propria_palavra(conexao: Conexao) -> None:
    # "veículo" está escrito, mas "remédio" só bate pelo radical de "médicas": não entra.
    nova(conexao, 1, objeto="Transporte de pacientes para consultas médicas em veículo")

    assert buscar(conexao, p_texto="remédio carro") == []


def test_exclusao_nao_tira_por_radical_parecido(conexao: Conexao) -> None:
    # "médicos" tem o radical de "medicamento", mas não é remédio: continua na lista.
    chave = nova(conexao, 1, objeto="Exames médicos ocupacionais")

    assert chaves(buscar(conexao, p_texto="exame -remédio")) == [chave]


def test_exclusao_vale_para_os_sinonimos(conexao: Conexao) -> None:
    nova(conexao, 1, objeto="Pneus para veículo")
    maquinas = nova(conexao, 2, objeto="Pneus para máquinas")

    assert sinonimos_por_chave(buscar(conexao, p_texto="pneu -carro")) == {maquinas: []}


def test_frase_exata_com_sinonimo(conexao: Conexao) -> None:
    chave = nova(conexao, 1, objeto="Aluguel de veículo")
    nova(conexao, 2, objeto="Aluguel de sala e veículo")

    assert chaves(buscar(conexao, p_texto='"aluguel de carro"')) == [chave]


def test_ou_com_sinonimo(conexao: Conexao) -> None:
    remedio = nova(conexao, 1, dias=3, objeto="Aquisição de medicamentos")
    cadeira = nova(conexao, 2, dias=5, objeto="Aquisição de cadeiras")

    assert set(chaves(buscar(conexao, p_texto="remédio or cadeira"))) == {remedio, cadeira}


def test_palavra_sem_sinonimo_funciona_como_antes(conexao: Conexao) -> None:
    chave = nova(conexao, 1, objeto="Aquisição de cadeiras")

    assert sinonimos_por_chave(buscar(conexao, p_texto="cadeira")) == {chave: []}


def test_total_e_filtros_contam_os_sinonimos(conexao: Conexao) -> None:
    joinville: dict[str, Any] = {"codigo_ibge": JOINVILLE, "municipio_nome": "Joinville"}
    for numero in range(1, 26):
        nova(conexao, numero, dias=numero, objeto="Aquisição de veículo", **joinville)
    nova(conexao, 26, objeto="Aquisição de veículo")

    linhas = buscar(conexao, p_texto="carro", p_codigo_ibge=JOINVILLE)

    assert len(linhas) == 20
    assert {linha["total"] for linha in linhas} == {25}


def test_dois_termos_com_sinonimo(conexao: Conexao) -> None:
    chave = nova(conexao, 1, objeto="Medicamentos e veículo")

    assert sinonimos_por_chave(buscar(conexao, p_texto="remédio carro")) == {
        chave: ["veículo", "medicamento"]
    }


def test_sem_texto_a_etiqueta_vem_vazia(conexao: Conexao) -> None:
    nova(conexao, 1, objeto="Aquisição de medicamentos")

    assert [linha["sinonimos_usados"] for linha in buscar(conexao)] == [[]]


@pytest.mark.parametrize(
    ("termo", "equivalentes"),
    [
        ("de", ["remedio"]),
        ("duas palavras", ["x"]),
        ("", ["x"]),
        ("pneu", []),
        ("pneu", ["a b"]),
        ("pneu", ["a|b"]),
        ("pneu", ["de"]),
        ("pneu", ["roda", None]),
    ],
)
def test_tabela_recusa_linha_invalida(
    conexao: Conexao, termo: str, equivalentes: list[str]
) -> None:
    with pytest.raises(psycopg.errors.CheckViolation), conexao.transaction():
        conexao.execute(
            "insert into public.sinonimos (termo, equivalentes) values (%s, %s)",
            (termo, equivalentes),
        )


def test_nenhuma_palavra_e_termo_e_equivalente(conexao: Conexao) -> None:
    encadeados = conexao.execute(
        """
        select s.termo, t.termo
        from public.sinonimos_consulta s
        join public.sinonimos_consulta t on t.termo <> s.termo and s.substituto @> t.alvo
        """
    ).fetchall()

    assert encadeados == []


def test_lista_tem_os_pares_do_design(conexao: Conexao) -> None:
    linhas = conexao.execute("select termo, equivalentes from public.sinonimos").fetchall()
    lista: dict[str, list[str]] = dict(linhas)

    assert "medicamento" in lista["remédio"]
    assert {"veículo", "automóvel"} <= set(lista["carro"])


def test_anon_le_sinonimos_e_nao_grava(conexao: Conexao) -> None:
    nova(conexao, 1, objeto="Aquisição de medicamentos")

    with conexao.transaction():
        conexao.execute("set local role anon")
        assert len(buscar(conexao, p_texto="remédio")) == 1
        assert conexao.execute("select count(*) from public.sinonimos").fetchone() != (0,)
        assert conexao.execute("select count(*) from public.sinonimos_consulta").fetchone() != (0,)

    # "new row violates row-level security policy" (SQLSTATE 42501)
    with pytest.raises(psycopg.errors.InsufficientPrivilege), conexao.transaction():
        conexao.execute("set local role anon")
        conexao.execute("insert into public.sinonimos (termo, equivalentes) values ('x', '{y}')")
