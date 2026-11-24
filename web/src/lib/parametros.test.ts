import { describe, expect, it } from "vitest";

import { lerFiltros as lerFiltrosEm, linkCom, linkDaPagina } from "./parametros";

// "Hoje" fixo, para os testes não dependerem do relógio.
const HOJE = "2026-11-24";
const lerFiltros = (parametros: Parameters<typeof lerFiltrosEm>[0]) =>
  lerFiltrosEm(parametros, HOJE);

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

  it("aceita a_partir de hoje em diante, como data real", () => {
    expect(lerFiltros({ a_partir: "2026-12-15" }).aPartir).toBe("2026-12-15");
    expect(lerFiltros({ a_partir: HOJE }).aPartir).toBe(HOJE);
  });

  it("ignora a_partir impossível, mal escrita ou que já passou", () => {
    for (const a_partir of ["2026-02-30", "abc", "2026-11-23", "15/12/2026"]) {
      expect(lerFiltros({ a_partir }).aPartir).toBeUndefined();
    }
  });

  it("aceita só mes no formato AAAA-MM", () => {
    expect(lerFiltros({ mes: "2026-12" }).mes).toBe("2026-12");
    for (const mes of ["2026-13", "2026-1", "dezembro"]) {
      expect(lerFiltros({ mes }).mes).toBeUndefined();
    }
  });

  it("o filtro antigo de prazo não existe mais", () => {
    expect(lerFiltros({ prazo: "7" })).toEqual({ pagina: 1 });
  });

  it("página inválida vira 1", () => {
    for (const pagina of ["-1", "abc", "0", "2.5"]) {
      expect(lerFiltros({ pagina }).pagina).toBe(1);
    }
    expect(lerFiltros({ pagina: "3" }).pagina).toBe(3);
  });

  it("um parâmetro inválido não derruba os outros", () => {
    expect(lerFiltros({ q: "luva", a_partir: "ontem", pagina: "abc", modalidade: "6" })).toEqual({
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
    expect(linkDaPagina({ municipio: "4209102", pagina: 1 }, 1)).toBe("/?municipio=4209102");
  });

  it("mantém a data e o mês do calendário", () => {
    expect(linkDaPagina({ q: "x", aPartir: "2026-12-15", mes: "2026-12", pagina: 1 }, 2)).toBe(
      "/?q=x&a_partir=2026-12-15&mes=2026-12&pagina=2",
    );
  });
});

describe("linkCom", () => {
  it("troca um filtro, mantém os outros e volta para a página 1", () => {
    expect(linkCom({ q: "pneu", pagina: 2 }, { aPartir: "2026-12-15", mes: "2026-12" })).toBe(
      "/?q=pneu&a_partir=2026-12-15&mes=2026-12",
    );
  });

  it("tira o filtro que vem como undefined", () => {
    expect(linkCom({ q: "pneu", municipio: "4209102", pagina: 3 }, { municipio: undefined })).toBe(
      "/?q=pneu",
    );
  });
});
