"""Uma execução completa da coleta: baixa, grava e registra o resultado na tabela `coletas`."""

import logging

from radar_coletor.banco import Conexao, finalizar_coleta, gravar_contratacoes, iniciar_coleta
from radar_coletor.cliente import ClientePNCP

log = logging.getLogger(__name__)


class ColetaVazia(Exception):
    """A API não devolveu nenhuma contratação válida: provável problema na fonte."""


def executar_coleta(conexao: Conexao, cliente: ClientePNCP, *, uf: str = "SC") -> bool:
    """Coleta as contratações abertas da UF e grava no banco. Devolve True se deu certo.

    A conexão precisa estar em autocommit: o registro da coleta é gravado à parte, para a falha
    ficar registrada mesmo quando a gravação das contratações é desfeita.
    """
    coleta_id = iniciar_coleta(conexao)
    log.info("Coleta %d iniciada (UF %s)", coleta_id, uf)

    try:
        resultado = cliente.listar_propostas_abertas(uf=uf)
        if not resultado.contratacoes:
            raise ColetaVazia("A API não devolveu nenhuma contratação válida.")
        gravacao = gravar_contratacoes(conexao, resultado.contratacoes, resultado.brutos)
    except Exception as erro:
        # Qualquer falha fica registrada no banco antes de a coleta terminar com erro.
        log.exception("Coleta %d falhou", coleta_id)
        finalizar_coleta(conexao, coleta_id, status="falha", erro=f"{type(erro).__name__}: {erro}")
        return False

    finalizar_coleta(
        conexao,
        coleta_id,
        status="sucesso",
        paginas_lidas=resultado.paginas_lidas,
        registros_validos=len(resultado.contratacoes),
        invalidos=resultado.invalidos,
        gravacao=gravacao,
    )
    log.info(
        "Coleta %d concluída: %d páginas, %d novas, %d atualizadas, %d inválidas",
        coleta_id,
        resultado.paginas_lidas,
        gravacao.novas,
        gravacao.atualizadas,
        len(resultado.invalidos),
    )
    return True
