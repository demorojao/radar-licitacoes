import { z } from "zod";

/** Filtros da tela, lidos da URL (`/?q=limpeza&municipio=4209102&a_partir=2026-12-15`). */
export type Filtros = {
  q?: string;
  municipio?: string;
  modalidade?: number;
  /** "AAAA-MM-DD": licitações que encerram deste dia em diante (horário de Brasília). */
  aPartir?: string;
  /** "AAAA-MM": o mês que o calendário mostra. */
  mes?: string;
  pagina: number;
};

type ParametrosDaUrl = Record<string, string | string[] | undefined>;

// Com o parâmetro repetido na URL (`?q=a&q=b`), o Next entrega uma lista: vale o primeiro.
const primeiro = (valor: unknown) => (Array.isArray(valor) ? valor[0] : valor);

/** Data real no formato AAAA-MM-DD (recusa 2026-02-30). */
function dataReal(texto: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) return false;
  const data = new Date(`${texto}T12:00:00Z`);
  return !Number.isNaN(data.getTime()) && data.toISOString().slice(0, 10) === texto;
}

// Cada campo tem o seu .catch: um parâmetro inválido é ignorado sem derrubar os outros.
function esquema(hoje: string) {
  return z.object({
    q: z
      .preprocess(primeiro, z.string().trim().min(1).transform((texto) => texto.slice(0, 200)))
      .optional()
      .catch(undefined),
    municipio: z
      .preprocess(primeiro, z.string().regex(/^\d{7}$/))
      .optional()
      .catch(undefined),
    modalidade: z
      .preprocess(primeiro, z.string().regex(/^\d{1,3}$/).transform(Number))
      .optional()
      .catch(undefined),
    // Uma data que já passou não serve para "a partir de": é ignorada.
    a_partir: z
      .preprocess(primeiro, z.string().refine(dataReal).refine((data) => data >= hoje))
      .optional()
      .catch(undefined),
    mes: z
      .preprocess(primeiro, z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/))
      .optional()
      .catch(undefined),
    pagina: z.preprocess(primeiro, z.string().regex(/^[1-9]\d{0,4}$/).transform(Number)).catch(1),
  });
}

/**
 * Lê e valida os filtros da URL. Nunca lança erro: o que for inválido é ignorado.
 * `hoje` é a data de Brasília (AAAA-MM-DD), para recusar datas que já passaram.
 */
export function lerFiltros(parametros: ParametrosDaUrl, hoje: string): Filtros {
  const { a_partir, ...lidos } = esquema(hoje).parse(parametros);
  return Object.fromEntries(
    Object.entries({ ...lidos, aPartir: a_partir }).filter(([, valor]) => valor !== undefined),
  ) as Filtros;
}

/** Endereço dos filtros, sem parâmetros vazios e sem `pagina=1`. */
function endereco(filtros: Filtros, pagina: number): string {
  const parametros = new URLSearchParams();
  if (filtros.q) parametros.set("q", filtros.q);
  if (filtros.municipio) parametros.set("municipio", filtros.municipio);
  if (filtros.modalidade !== undefined) parametros.set("modalidade", String(filtros.modalidade));
  if (filtros.aPartir) parametros.set("a_partir", filtros.aPartir);
  if (filtros.mes) parametros.set("mes", filtros.mes);
  if (pagina > 1) parametros.set("pagina", String(pagina));
  const texto = parametros.toString();
  return texto ? `/?${texto}` : "/";
}

/** A mesma busca em outra página. */
export function linkDaPagina(filtros: Filtros, pagina: number): string {
  return endereco(filtros, pagina);
}

/** A mesma busca com alguns filtros trocados (`undefined` tira o filtro), na página 1. */
export function linkCom(filtros: Filtros, mudancas: Partial<Omit<Filtros, "pagina">>): string {
  return endereco({ ...filtros, ...mudancas }, 1);
}
