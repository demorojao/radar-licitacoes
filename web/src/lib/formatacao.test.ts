import { describe, expect, it } from "vitest";

import {
  formatarData,
  formatarDataHora,
  formatarValor,
  linkPncp,
  prazoRelativo,
  prazoSuspeito,
} from "./formatacao";

// O Intl separa "R$" do número com um espaço que não quebra linha.
const R$ = "R$ ";

describe("formatarValor", () => {
  it("formata em reais no padrão brasileiro, sem perder centavos", () => {
    expect(formatarValor("258930.70")).toBe(`${R$}258.930,70`);
    expect(formatarValor("2297628657.83")).toBe(`${R$}2.297.628.657,83`);
  });

  it("valor zero ou ausente não é R$ 0", () => {
    expect(formatarValor("0.00")).toBe("Valor não informado");
    expect(formatarValor(null)).toBe("Valor não informado");
  });
});

describe("formatarDataHora", () => {
  it("mostra no horário de Brasília, mesmo com o servidor em UTC", () => {
    expect(formatarDataHora("2026-11-26T02:30:00Z")).toBe("25/11/2026 23:30");
  });
});

describe("formatarData", () => {
  it("mostra só a data, no horário de Brasília", () => {
    expect(formatarData("2125-11-05T03:00:00Z")).toBe("05/11/2125");
    expect(formatarData("2026-11-26T02:30:00Z")).toBe("25/11/2026");
  });
});

describe("prazoRelativo", () => {
  const agora = new Date("2026-11-22T15:00:00Z"); // 12:00 em Brasília

  it("conta por dia do calendário de Brasília", () => {
    expect(prazoRelativo("2026-11-22T23:00:00-03:00", agora)).toBe("encerra hoje");
    expect(prazoRelativo("2026-11-23T09:00:00-03:00", agora)).toBe("encerra amanhã");
    expect(prazoRelativo("2026-11-25T09:00:00-03:00", agora)).toBe("encerra em 3 dias");
    expect(prazoRelativo("2027-02-20T09:00:00-03:00", agora)).toBe("encerra em 3 meses");
  });

  it("23:30 em Brasília ainda é hoje, mesmo já sendo amanhã em UTC", () => {
    expect(prazoRelativo("2026-11-23T02:30:00Z", agora)).toBe("encerra hoje");
  });
});

describe("prazoSuspeito", () => {
  const agora = new Date("2026-11-22T15:00:00Z");

  it("marca prazo a mais de 5 anos", () => {
    expect(prazoSuspeito("2031-11-23T15:00:00Z", agora)).toBe(true);
    expect(prazoSuspeito("2125-11-05T03:00:00Z", agora)).toBe(true);
    expect(prazoSuspeito("2028-11-22T15:00:00Z", agora)).toBe(false);
  });
});

describe("linkPncp", () => {
  it("aponta para a página do edital no portal oficial", () => {
    expect(
      linkPncp({ cnpj_orgao: "11433441000101", ano_compra: 2023, sequencial_compra: 1 }),
    ).toBe("https://pncp.gov.br/app/editais/11433441000101/2023/1");
  });
});
