import { describe, expect, it } from "vitest";

import { deveEnviar } from "./envio-do-seletor";

describe("deveEnviar", () => {
  it("com mouse ou toque, aplica ao escolher", () => {
    expect(deveEnviar({ evento: "change", peloTeclado: false, mudou: true })).toBe(true);
  });

  it("com as setas do teclado, não aplica a cada troca", () => {
    expect(deveEnviar({ evento: "change", peloTeclado: true, mudou: true })).toBe(false);
  });

  it("pelo teclado, aplica ao apertar Enter ou ao sair do campo, se mudou", () => {
    expect(deveEnviar({ evento: "enter", peloTeclado: true, mudou: true })).toBe(true);
    expect(deveEnviar({ evento: "saiu", peloTeclado: true, mudou: true })).toBe(true);
  });

  it("sem mudança, não envia de novo", () => {
    expect(deveEnviar({ evento: "saiu", peloTeclado: true, mudou: false })).toBe(false);
    expect(deveEnviar({ evento: "enter", peloTeclado: true, mudou: false })).toBe(false);
  });
});
