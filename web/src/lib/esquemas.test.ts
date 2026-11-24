import { describe, expect, it } from "vitest";

import { lerEncerramentos, lerOpcoes, lerResultadoBusca } from "./esquemas";

// Uma linha como a função buscar_contratacoes devolve pela API do Supabase.
const LINHA = {
  numero_controle_pncp: "11433441000101-1-000001/2023",
  objeto: "Aquisição de material de limpeza",
  orgao_razao_social: "PREFEITURA MUNICIPAL DE JOINVILLE",
  municipio_nome: "Joinville",
  modalidade_id: 6,
  modalidade_nome: "Pregão - Eletrônico",
  valor_total_estimado: "258930.70",
  data_encerramento_proposta: "2026-11-25T12:00:00+00:00",
  cnpj_orgao: "11433441000101",
  ano_compra: 2023,
  sequencial_compra: 1,
  total: 25,
  pagina: 2,
  sinonimos_usados: [],
  data_publicacao: "2025-11-25T15:02:00+00:00",
};

describe("lerResultadoBusca", () => {
  it("separa as licitações do total e da página", () => {
    const resultado = lerResultadoBusca([LINHA]);

    expect(resultado.total).toBe(25);
    expect(resultado.pagina).toBe(2);
    expect(resultado.totalDePaginas).toBe(2);
    expect(resultado.contratacoes).toHaveLength(1);
    expect(resultado.contratacoes[0]).not.toHaveProperty("total");
    expect(resultado.contratacoes[0].objeto).toBe("Aquisição de material de limpeza");
  });

  it("mantém a data de publicação, que pode faltar", () => {
    expect(lerResultadoBusca([LINHA]).contratacoes[0].data_publicacao).toBe(
      "2025-11-25T15:02:00+00:00",
    );
    expect(
      lerResultadoBusca([{ ...LINHA, data_publicacao: null }]).contratacoes[0].data_publicacao,
    ).toBeNull();
  });

  it("aceita valor ausente", () => {
    const resultado = lerResultadoBusca([{ ...LINHA, valor_total_estimado: null }]);

    expect(resultado.contratacoes[0].valor_total_estimado).toBeNull();
  });

  it("sem linhas, o resultado é vazio", () => {
    expect(lerResultadoBusca([])).toEqual({
      contratacoes: [],
      total: 0,
      pagina: 1,
      totalDePaginas: 0,
    });
  });

  it("mantém os sinônimos usados de cada licitação", () => {
    const resultado = lerResultadoBusca([{ ...LINHA, sinonimos_usados: ["medicamento"] }]);

    expect(resultado.contratacoes[0].sinonimos_usados).toEqual(["medicamento"]);
  });

  it("recusa sinônimos fora de uma lista de textos", () => {
    expect(() => lerResultadoBusca([{ ...LINHA, sinonimos_usados: "medicamento" }])).toThrow();
  });

  it("recusa uma resposta em formato inesperado", () => {
    const semObjeto: Record<string, unknown> = { ...LINHA };
    delete semObjeto.objeto;
    expect(() => lerResultadoBusca([semObjeto])).toThrow();
    expect(() => lerResultadoBusca([{ ...LINHA, total: "25" }])).toThrow();
    expect(() => lerResultadoBusca(null)).toThrow();
  });
});

describe("lerOpcoes", () => {
  it("separa municípios e modalidades na ordem recebida", () => {
    const opcoes = lerOpcoes([
      { tipo: "modalidade", valor: "6", nome: "Pregão - Eletrônico", quantidade: 2 },
      { tipo: "municipio", valor: "4209102", nome: "Joinville", quantidade: 3 },
      { tipo: "municipio", valor: "4217808", nome: "Taió", quantidade: 1 },
    ]);

    expect(opcoes.modalidades).toEqual([{ valor: "6", nome: "Pregão - Eletrônico", quantidade: 2 }]);
    expect(opcoes.municipios.map((opcao) => opcao.nome)).toEqual(["Joinville", "Taió"]);
  });

  it("recusa um tipo desconhecido", () => {
    expect(() => lerOpcoes([{ tipo: "estado", valor: "SC", nome: "SC", quantidade: 1 }])).toThrow();
  });
});

describe("lerEncerramentos", () => {
  it("monta um mapa de dia para quantidade", () => {
    const mapa = lerEncerramentos([
      { dia: "2026-12-15", quantidade: 2 },
      { dia: "2026-12-16", quantidade: 1 },
    ]);

    expect(mapa.get("2026-12-15")).toBe(2);
    expect(mapa.get("2026-12-16")).toBe(1);
    expect(mapa.size).toBe(2);
  });

  it("recusa um formato inesperado", () => {
    expect(() => lerEncerramentos([{ dia: 15, quantidade: 2 }])).toThrow();
    expect(() => lerEncerramentos([{ dia: "15/12/2026", quantidade: 2 }])).toThrow();
  });
});
