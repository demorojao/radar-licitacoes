import { describe, expect, it } from "vitest";

import { type Dia, mesDoCalendario, montarMes, rotuloDoDia } from "./calendario";

const HOJE = "2026-11-24";

function dias(semanas: (Dia | null)[][]): Dia[] {
  return semanas.flat().filter((dia): dia is Dia => dia !== null);
}

describe("montarMes", () => {
  it("cada semana vai de domingo a sábado, com casas vazias nas pontas", () => {
    const { semanas } = montarMes("2026-12", new Map(), HOJE);

    expect(semanas.every((semana) => semana.length === 7)).toBe(true);
    // 1º de dezembro de 2026 é uma terça: domingo e segunda ficam vazios.
    expect(semanas[0].slice(0, 3).map((dia) => dia?.numero ?? null)).toEqual([null, null, 1]);
  });

  it("mês que começa no domingo não tem casa vazia antes", () => {
    expect(montarMes("2026-11", new Map(), HOJE).semanas[0][0]?.numero).toBe(1);
  });

  it("mês que começa no sábado tem 6 casas vazias antes", () => {
    const { semanas } = montarMes("2026-08", new Map(), "2026-08-01");

    expect(semanas[0].slice(0, 6)).toEqual([null, null, null, null, null, null]);
    expect(semanas[0][6]?.numero).toBe(1);
  });

  it("não perde nem repete dias, em meses de 28 a 31 dias", () => {
    for (const [mes, total] of [
      ["2027-02", 28],
      ["2028-02", 29],
      ["2026-11", 30],
      ["2026-12", 31],
    ] as const) {
      const numeros = dias(montarMes(mes, new Map(), HOJE).semanas).map((dia) => dia.numero);
      expect(numeros).toEqual(Array.from({ length: total }, (_, i) => i + 1));
    }
  });

  it("marca passado, hoje, escolhido e a quantidade de cada dia", () => {
    const contagens = new Map([["2026-11-30", 5]]);
    const lista = dias(montarMes("2026-11", contagens, HOJE, "2026-11-30").semanas);
    const pelo = (numero: number) => lista.find((dia) => dia.numero === numero);

    expect(pelo(23)).toMatchObject({ data: "2026-11-23", passado: true, hoje: false });
    expect(pelo(24)).toMatchObject({ passado: false, hoje: true, escolhido: false });
    expect(pelo(30)).toMatchObject({ escolhido: true, quantidade: 5 });
    expect(pelo(29)?.quantidade).toBe(0);
  });

  it("não deixa voltar para antes do mês atual", () => {
    expect(montarMes("2026-11", new Map(), HOJE)).toMatchObject({
      anterior: null,
      proximo: "2026-12",
    });
    expect(montarMes("2026-12", new Map(), HOJE)).toMatchObject({
      anterior: "2026-11",
      proximo: "2027-01",
    });
  });

  it("dá nome ao mês", () => {
    expect(montarMes("2026-12", new Map(), HOJE).titulo).toBe("dezembro de 2026");
  });
});

describe("mesDoCalendario", () => {
  it("usa o mês pedido na URL, mas nunca antes do mês atual", () => {
    expect(mesDoCalendario({ mes: "2027-02", pagina: 1 }, HOJE)).toBe("2027-02");
    expect(mesDoCalendario({ mes: "2026-01", pagina: 1 }, HOJE)).toBe("2026-11");
  });

  it("sem mês na URL, abre no mês da data escolhida ou no atual", () => {
    expect(mesDoCalendario({ aPartir: "2026-12-15", pagina: 1 }, HOJE)).toBe("2026-12");
    expect(mesDoCalendario({ pagina: 1 }, HOJE)).toBe("2026-11");
  });
});

describe("rotuloDoDia", () => {
  const dia = {
    data: "2026-12-15",
    numero: 15,
    quantidade: 3,
    passado: false,
    hoje: false,
    escolhido: false,
  };

  it("diz o dia, o mês e quantas encerram", () => {
    expect(rotuloDoDia(dia)).toBe("15 de dezembro: 3 licitações encerram. Ver a partir deste dia.");
    expect(rotuloDoDia({ ...dia, quantidade: 1 })).toBe(
      "15 de dezembro: 1 licitação encerra. Ver a partir deste dia.",
    );
  });

  it("avisa quando é hoje ou o dia escolhido", () => {
    expect(rotuloDoDia({ ...dia, hoje: true })).toMatch(/^15 de dezembro \(hoje\):/);
    expect(rotuloDoDia({ ...dia, escolhido: true })).toMatch(/^15 de dezembro \(escolhido\):/);
  });
});
