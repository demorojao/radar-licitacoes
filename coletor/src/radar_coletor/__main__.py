"""Ponto de entrada da coleta: `python -m radar_coletor`.

Lê a URL do banco de DATABASE_URL. Na máquina de desenvolvimento:
`uv run --env-file .env python -m radar_coletor`.
"""

import logging
import os
import sys

import psycopg

from radar_coletor.cliente import ClientePNCP, criar_cliente_http
from radar_coletor.coleta import executar_coleta


def main() -> int:
    logging.basicConfig(
        level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s"
    )
    url = os.environ.get("DATABASE_URL")
    if not url:
        print("Defina DATABASE_URL (veja coletor/.env.example).", file=sys.stderr)
        return 2

    with psycopg.connect(url, autocommit=True) as conexao, criar_cliente_http() as http:
        deu_certo = executar_coleta(conexao, ClientePNCP(http))
    return 0 if deu_certo else 1


if __name__ == "__main__":
    sys.exit(main())
