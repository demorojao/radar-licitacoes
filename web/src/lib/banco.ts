import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cache } from "react";

import {
  lerEncerramentos,
  lerOpcoes,
  lerResultadoBusca,
  type OpcoesDeFiltro,
  type ResultadoBusca,
} from "./esquemas";
import type { Filtros } from "./parametros";
import { comTempoLimite } from "./tempo-limite";

// Um banco que não responde em 8 s vira a página de erro, em vez de "Carregando…" sem fim.
const TEMPO_LIMITE_MS = 8_000;

// Só roda no servidor. A chave é a pública (publishable): ela só faz o que o RLS libera, que é
// ler. Mesmo assim fica no servidor, porque o navegador não precisa dela.

function cliente(): SupabaseClient {
  // Lidas aqui, e não no topo do módulo, para o `next build` passar sem as variáveis.
  const url = process.env.SUPABASE_URL;
  const chave = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !chave) {
    throw new Error("SUPABASE_URL e SUPABASE_PUBLISHABLE_KEY precisam estar definidas");
  }
  return createClient(url, chave, {
    auth: { persistSession: false },
    global: { fetch: comTempoLimite(fetch, TEMPO_LIMITE_MS) },
  });
}

/** Licitações abertas que atendem aos filtros, 20 por página. */
export async function buscarContratacoes(filtros: Filtros): Promise<ResultadoBusca> {
  const { data, error } = await cliente().rpc("buscar_contratacoes", {
    p_texto: filtros.q ?? null,
    p_codigo_ibge: filtros.municipio ?? null,
    p_modalidade_id: filtros.modalidade ?? null,
    p_pagina: filtros.pagina,
    p_encerra_a_partir: filtros.aPartir ?? null,
    p_ordem: filtros.ordem ?? null,
  });
  if (error) throw new Error(`Falha na busca: ${error.message}`);
  return lerResultadoBusca(data);
}

/** Quantas licitações (com os filtros de texto, município e modalidade) encerram em cada dia. */
export async function encerramentosPorDia(
  filtros: Filtros,
  mes: string,
): Promise<Map<string, number>> {
  const { data, error } = await cliente().rpc("encerramentos_por_dia", {
    p_texto: filtros.q ?? null,
    p_codigo_ibge: filtros.municipio ?? null,
    p_modalidade_id: filtros.modalidade ?? null,
    p_mes: `${mes}-01`,
  });
  if (error) throw new Error(`Falha ao carregar o calendário: ${error.message}`);
  return lerEncerramentos(data);
}

/** Municípios e modalidades com licitação aberta, para os seletores. */
// cache(): o cabeçalho e os filtros pedem as opções na mesma visita; o banco é consultado uma vez.
export const opcoesDeFiltro = cache(async (): Promise<OpcoesDeFiltro> => {
  const { data, error } = await cliente().rpc("opcoes_de_filtro");
  if (error) throw new Error(`Falha ao carregar os filtros: ${error.message}`);
  return lerOpcoes(data);
});

/** Quando terminou a última coleta com sucesso (ISO 8601), ou null se nunca houve. */
export async function ultimaColeta(): Promise<string | null> {
  const { data, error } = await cliente()
    .from("coletas")
    .select("terminada_em")
    .eq("status", "sucesso")
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Falha ao ler a última coleta: ${error.message}`);
  const terminadaEm: unknown = data?.terminada_em ?? null;
  return typeof terminadaEm === "string" ? terminadaEm : null;
}
