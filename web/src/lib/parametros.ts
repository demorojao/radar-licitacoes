import { z } from "zod";

/** Filtro de prazo: licitações que encerram em até 7, 30 ou 90 dias. */
export type Prazo = 7 | 30 | 90;

/** Filtros da tela, lidos da URL (`/?q=limpeza&municipio=4209102&pagina=2`). */
export type Filtros = {
  q?: string;
  municipio?: string;
  modalidade?: number;
  prazo?: Prazo;
  pagina: number;
};

type ParametrosDaUrl = Record<string, string | string[] | undefined>;

// Com o parâmetro repetido na URL (`?q=a&q=b`), o Next entrega uma lista: vale o primeiro.
const primeiro = (valor: unknown) => (Array.isArray(valor) ? valor[0] : valor);

// Cada campo tem o seu .catch: um parâmetro inválido é ignorado sem derrubar os outros.
const esquema = z.object({
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
  prazo: z
    .preprocess(primeiro, z.enum(["7", "30", "90"]).transform((prazo) => Number(prazo) as Prazo))
    .optional()
    .catch(undefined),
  pagina: z.preprocess(primeiro, z.string().regex(/^[1-9]\d{0,4}$/).transform(Number)).catch(1),
});

/** Lê e valida os filtros da URL. Nunca lança erro: o que for inválido é ignorado. */
export function lerFiltros(parametros: ParametrosDaUrl): Filtros {
  const lidos = esquema.parse(parametros);
  return Object.fromEntries(
    Object.entries(lidos).filter(([, valor]) => valor !== undefined),
  ) as Filtros;
}

/** Endereço da mesma busca em outra página, sem parâmetros vazios e sem `pagina=1`. */
export function linkDaPagina(filtros: Filtros, pagina: number): string {
  const parametros = new URLSearchParams();
  if (filtros.q) parametros.set("q", filtros.q);
  if (filtros.municipio) parametros.set("municipio", filtros.municipio);
  if (filtros.modalidade !== undefined) parametros.set("modalidade", String(filtros.modalidade));
  if (filtros.prazo !== undefined) parametros.set("prazo", String(filtros.prazo));
  if (pagina > 1) parametros.set("pagina", String(pagina));
  const texto = parametros.toString();
  return texto ? `/?${texto}` : "/";
}
