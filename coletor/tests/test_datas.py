from datetime import UTC, datetime, timedelta

import pytest

from radar_coletor.datas import FUSO_BRASILIA, converter_data_pncp


def test_data_sem_fuso_e_lida_como_horario_de_brasilia() -> None:
    # Formato real da API: "dataEncerramentoProposta": "2026-11-27T08:30:00"
    data = converter_data_pncp("2026-11-27T08:30:00")

    assert data is not None
    assert data.isoformat() == "2026-11-27T08:30:00-03:00"


def test_em_utc_o_mesmo_instante_fica_tres_horas_a_frente() -> None:
    data = converter_data_pncp("2026-11-27T08:30:00")

    assert data is not None
    assert data.astimezone(UTC) == datetime(2026, 11, 27, 11, 30, tzinfo=UTC)


def test_data_que_ja_tem_fuso_mantem_o_mesmo_instante() -> None:
    data = converter_data_pncp("2026-11-27T11:30:00Z")

    assert data == datetime(2026, 11, 27, 8, 30, tzinfo=FUSO_BRASILIA)
    assert data is not None
    assert data.utcoffset() == timedelta(hours=-3)


def test_aceita_fracao_de_segundo() -> None:
    data = converter_data_pncp("2026-10-03T15:11:52.123")

    assert data is not None
    assert data.microsecond == 123000


@pytest.mark.parametrize("valor", [None, "", "   "])
def test_valor_ausente_vira_none(valor: str | None) -> None:
    # Vários campos de data da API são opcionais e chegam como null.
    assert converter_data_pncp(valor) is None


def test_formato_desconhecido_gera_erro_em_vez_de_data_errada() -> None:
    with pytest.raises(ValueError):
        converter_data_pncp("27/11/2026 08:30")
