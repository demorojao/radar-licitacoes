"""Modelos das respostas da API do PNCP, validados com Pydantic.

Só é obrigatório o que o Radar não pode dispensar (identificador, objeto, modalidade, situação,
prazo, órgão e município). O resto é opcional, para um campo secundário faltando não descartar
uma licitação válida. A escolha se baseou em 2.100 registros reais de SC (ver docs/api-pncp.md).
"""

from datetime import datetime
from decimal import Decimal
from typing import Annotated, Any

from pydantic import BaseModel, BeforeValidator, ConfigDict, Field

from radar_coletor.datas import converter_data_pncp


def _validar_data(valor: object) -> datetime | None:
    if valor is None or isinstance(valor, str):
        return converter_data_pncp(valor)
    raise ValueError("a data deve vir como texto no formato ISO 8601")


def _texto_ou_none(valor: object) -> object:
    """Remove espaços nas pontas; texto vazio vira None (a API manda "" em campos opcionais)."""
    if isinstance(valor, str):
        return valor.strip() or None
    return valor


Data = Annotated[datetime, BeforeValidator(_validar_data)]
DataOpcional = Annotated[datetime | None, BeforeValidator(_validar_data)]
Texto = Annotated[str, BeforeValidator(_texto_ou_none)]
TextoOpcional = Annotated[str | None, BeforeValidator(_texto_ou_none)]


class _ModeloPNCP(BaseModel):
    # Campos novos da API são ignorados, e o modelo não muda depois de validado.
    model_config = ConfigDict(extra="ignore", frozen=True)


class OrgaoEntidade(_ModeloPNCP):
    cnpj: str = Field(pattern=r"^\d{14}$")
    razao_social: Texto = Field(alias="razaoSocial")


class UnidadeOrgao(_ModeloPNCP):
    uf_sigla: str = Field(alias="ufSigla", pattern=r"^[A-Z]{2}$")
    municipio_nome: Texto = Field(alias="municipioNome")
    codigo_ibge: str = Field(alias="codigoIbge", pattern=r"^\d{7}$")
    nome_unidade: TextoOpcional = Field(default=None, alias="nomeUnidade")


class Contratacao(_ModeloPNCP):
    """Uma contratação (licitação) publicada no PNCP."""

    numero_controle_pncp: str = Field(
        alias="numeroControlePNCP", pattern=r"^\d{14}-\d+-\d{6}/\d{4}$"
    )
    ano_compra: int = Field(alias="anoCompra")
    sequencial_compra: int = Field(alias="sequencialCompra")
    numero_compra: TextoOpcional = Field(default=None, alias="numeroCompra")
    processo: TextoOpcional = None
    objeto_compra: Texto = Field(alias="objetoCompra")
    informacao_complementar: TextoOpcional = Field(default=None, alias="informacaoComplementar")
    modalidade_id: int = Field(alias="modalidadeId")
    modalidade_nome: Texto = Field(alias="modalidadeNome")
    modo_disputa_nome: TextoOpcional = Field(default=None, alias="modoDisputaNome")
    situacao_compra_id: int = Field(alias="situacaoCompraId")
    situacao_compra_nome: Texto = Field(alias="situacaoCompraNome")
    srp: bool | None = None  # sistema de registro de preços
    valor_total_estimado: Decimal | None = Field(default=None, alias="valorTotalEstimado")
    valor_total_homologado: Decimal | None = Field(default=None, alias="valorTotalHomologado")
    data_publicacao_pncp: DataOpcional = Field(default=None, alias="dataPublicacaoPncp")
    data_abertura_proposta: DataOpcional = Field(default=None, alias="dataAberturaProposta")
    data_encerramento_proposta: Data = Field(alias="dataEncerramentoProposta")
    data_atualizacao_global: DataOpcional = Field(default=None, alias="dataAtualizacaoGlobal")
    link_sistema_origem: TextoOpcional = Field(default=None, alias="linkSistemaOrigem")
    orgao_entidade: OrgaoEntidade = Field(alias="orgaoEntidade")
    unidade_orgao: UnidadeOrgao = Field(alias="unidadeOrgao")


class PaginaPNCP(_ModeloPNCP):
    """Envelope de paginação. Os registros ficam brutos para serem validados um a um."""

    registros: list[dict[str, Any]] = Field(alias="data")
    total_registros: int = Field(alias="totalRegistros")
    total_paginas: int = Field(alias="totalPaginas")
    numero_pagina: int = Field(alias="numeroPagina")
    paginas_restantes: int = Field(alias="paginasRestantes")
