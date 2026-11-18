"""Conversão das datas da API do PNCP.

A API devolve datas sem fuso horário (por exemplo, "2026-11-27T08:30:00"), no horário de
Brasília. Se essas datas forem tratadas como UTC, todo prazo fica 3 horas errado.

Premissa: as datas estão no horário de Brasília. Isso vale para Santa Catarina, que é o
escopo do projeto. Estados com outro fuso (como o Amazonas) precisariam ser verificados.
"""

from datetime import datetime
from zoneinfo import ZoneInfo

FUSO_BRASILIA = ZoneInfo("America/Sao_Paulo")


def converter_data_pncp(valor: str | None) -> datetime | None:
    """Converte uma data da API do PNCP em um datetime com fuso horário.

    - Sem fuso: interpreta como horário de Brasília.
    - Com fuso: mantém o mesmo instante, expresso no horário de Brasília.
    - None ou texto vazio: devolve None (campos opcionais da API).
    - Formato desconhecido: lança ValueError, para um dado estranho não virar uma data errada.
    """
    if valor is None or not valor.strip():
        return None

    data = datetime.fromisoformat(valor.strip())
    if data.tzinfo is None:
        return data.replace(tzinfo=FUSO_BRASILIA)
    return data.astimezone(FUSO_BRASILIA)
