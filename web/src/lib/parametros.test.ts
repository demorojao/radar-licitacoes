import { describe, expect, it } from "vitest";

import { lerFiltros, linkDaPagina } from "./parametros";

describe("lerFiltros", () => {
  it("sem parâmetros, começa na página 1 sem filtros", () => {
    expect(lerFiltros({})).toEqual({ pagina: 1 });
  });

  it("tira os espaços do texto e ignora texto vazio", () => {
    expect(lerFiltros({ q: "  limpeza  " }).q).toBe("limpeza");
    expect(lerFiltros({ q: "   " }).q).toBeUndefined();
  });

  it("corta um texto gigante em 200 caracteres", () => {
    expect(lerFiltros({ q: "a".repeat(10_000) }).q).toHaveLength(200);
  });

  it("com o parâmetro repetido, usa o primeiro", () => {
    expect(lerFiltros({ q: ["a", "b"] }).q).toBe("a");
  });

  it("aceita só código IBGE de 7 dígitos", () => {
    expect(lerFiltros({ municipio: "4209102" }).municipio).toBe("4209102");
    expect(lerFiltros({ municipio: "x" }).municipio).toBeUndefined();
    expect(lerFiltros({ municipio: "123" }).municipio).toBeUndefined();
  });

  it("aceita modalidade numérica", () => {
    expect(lerFiltros({ modalidade: "12" }).modalidade).toBe(12);
    expect(lerFiltros({ modalidade: "abc" }).modalidade).toBeUndefined();
  });

  it("aceita só os prazos 7, 30 e 90", () => {
    expect(lerFiltros({ prazo: "30" }).prazo).toBe(30);
    expect(lerFiltros({ prazo: "15" }).prazo).toBeUndefined();
  });

  it("página inválida vira 1", () => {
    for (const pagina of ["-1", "abc", "0", "2.5"]) {
      expect(lerFiltros({ pagina }).pagina).toBe(1);
    }
    expect(lerFiltros({ pagina: "3" }).pagina).toBe(3);
  });

  it("um parâmetro inválido não derruba os outros", () => {
    expect(lerFiltros({ q: "luva", prazo: "15", pagina: "abc", modalidade: "6" })).toEqual({
      q: "luva",
      modalidade: 6,
      pagina: 1,
    });
  });
});

describe("linkDaPagina", () => {
  it("mantém os filtros e troca a página", () => {
    expect(linkDaPagina({ q: "material de limpeza", pagina: 1 }, 2)).toBe(
      "/?q=material+de+limpeza&pagina=2",
    );
  });

  it("não repete pagina=1 nem parâmetros vazios", () => {
    expect(linkDaPagina({ pagina: 3 }, 1)).toBe("/");
    expect(linkDaPagina({ municipio: "4209102", prazo: 7, pagina: 1 }, 1)).toBe(
      "/?municipio=4209102&prazo=7",
    );
  });
});
