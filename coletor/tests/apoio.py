"""Apoio aos testes de banco: uma contratação mínima válida e um jeito curto de inseri-la."""

from typing import Any

import psycopg
from psycopg.types.json import Jsonb

Conexao = psycopg.Connection[tuple[Any, ...]]

CONTRATACAO_MINIMA: dict[str, Any] = {
    "numero_controle_pncp": "11433441000101-1-000001/2023",
    "cnpj_orgao": "11433441000101",
    "orgao_razao_social": "FUNDO MUNICIPAL DE SAUDE",
    "ano_compra": 2023,
    "sequencial_compra": 1,
    "objeto": "Credenciamento de serviços de saúde",
    "modalidade_id": 12,
    "modalidade_nome": "Credenciamento",
    "situacao_id": 1,
    "situacao_nome": "Divulgada no PNCP",
    "data_encerramento_proposta": "2027-06-18T17:30:00-03:00",
    "uf": "SC",
    "municipio_nome": "Taió",
    "codigo_ibge": "4217808",
    "payload": Jsonb({"numeroControlePNCP": "11433441000101-1-000001/2023"}),
}


def inserir(conexao: Conexao, **alteracoes: Any) -> None:
    linha = {**CONTRATACAO_MINIMA, **alteracoes}
    colunas = ", ".join(linha)
    marcadores = ", ".join(f"%({coluna})s" for coluna in linha)
    conexao.execute(f"insert into contratacoes ({colunas}) values ({marcadores})", linha)
