import { z } from "zod";

// O que vem do banco é entrada externa: valida antes de usar (regra do AGENTS.md).

const POR_PAGINA = 20;

const contratacao = z.object({
  numero_controle_pncp: z.string(),
  objeto: z.string(),
  orgao_razao_social: z.string(),
  municipio_nome: z.string(),
  modalidade_id: z.number().int(),
  modalidade_nome: z.string(),
  // Texto, para o dinheiro não passar por float.
  valor_total_estimado: z.string().nullable(),
  data_encerramento_proposta: z.string(),
  // Quando o órgão publicou no PNCP. Pode faltar.
  data_publicacao: z.string().nullable(),
  cnpj_orgao: z.string(),
  ano_compra: z.number().int(),
  sequencial_compra: z.number().int(),
  // Por quais sinônimos a licitação entrou na busca; vazio quando tem a palavra digitada.
  sinonimos_usados: z.array(z.string()),
});

const linhaDaBusca = contratacao.extend({
  total: z.number().int(),
  pagina: z.number().int(),
});

const linhaDeOpcao = z.object({
  tipo: z.enum(["municipio", "modalidade"]),
  valor: z.string(),
  nome: z.string(),
  quantidade: z.number().int(),
});

const linhaDeEncerramento = z.object({
  dia: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  quantidade: z.number().int(),
});

export type Contratacao = z.infer<typeof contratacao>;

export type ResultadoBusca = {
  contratacoes: Contratacao[];
  total: number;
  pagina: number;
  totalDePaginas: number;
};

export type Opcao = { valor: string; nome: string; quantidade: number };

export type OpcoesDeFiltro = { municipios: Opcao[]; modalidades: Opcao[] };

/** Valida as linhas de buscar_contratacoes. Lança erro se o formato não bater. */
export function lerResultadoBusca(linhas: unknown): ResultadoBusca {
  const validas = z.array(linhaDaBusca).parse(linhas);
  if (validas.length === 0) {
    return { contratacoes: [], total: 0, pagina: 1, totalDePaginas: 0 };
  }
  const { total, pagina } = validas[0];
  return {
    // O esquema de contratação descarta as chaves que não conhece (total e pagina).
    contratacoes: validas.map((linha) => contratacao.parse(linha)),
    total,
    pagina,
    totalDePaginas: Math.ceil(total / POR_PAGINA),
  };
}

/** Valida as linhas de opcoes_de_filtro e separa municípios de modalidades. */
export function lerOpcoes(linhas: unknown): OpcoesDeFiltro {
  const validas = z.array(linhaDeOpcao).parse(linhas);
  const opcoes = (tipo: "municipio" | "modalidade") =>
    validas
      .filter((linha) => linha.tipo === tipo)
      .map(({ valor, nome, quantidade }) => ({ valor, nome, quantidade }));
  return { municipios: opcoes("municipio"), modalidades: opcoes("modalidade") };
}

/** Valida as linhas de encerramentos_por_dia: dia ("AAAA-MM-DD") → quantidade. */
export function lerEncerramentos(linhas: unknown): Map<string, number> {
  const validas = z.array(linhaDeEncerramento).parse(linhas);
  return new Map(validas.map(({ dia, quantidade }) => [dia, quantidade]));
}
