import { describe, expect, it } from "vitest";

import { comTempoLimite } from "./tempo-limite";

// Um "fetch" que nunca responde: só termina se alguém cancelar o pedido.
const travado: typeof fetch = (_entrada, init) =>
  new Promise((_resolver, rejeitar) => {
    init?.signal?.addEventListener("abort", () => rejeitar(init.signal?.reason));
  });

describe("comTempoLimite", () => {
  it("cancela um pedido que não responde dentro do limite", async () => {
    const inicio = Date.now();

    await expect(comTempoLimite(travado, 50)("https://exemplo.test")).rejects.toThrow();
    expect(Date.now() - inicio).toBeLessThan(2000);
  });

  it("deixa passar a resposta que chega a tempo", async () => {
    const rapido: typeof fetch = async () => new Response("ok");

    const resposta = await comTempoLimite(rapido, 1000)("https://exemplo.test");

    expect(await resposta.text()).toBe("ok");
  });

  it("respeita o cancelamento de quem fez o pedido", async () => {
    const controle = new AbortController();
    const pedido = comTempoLimite(travado, 10_000)("https://exemplo.test", {
      signal: controle.signal,
    });

    controle.abort(new Error("cancelado por quem chamou"));

    await expect(pedido).rejects.toThrow("cancelado por quem chamou");
  });
});
