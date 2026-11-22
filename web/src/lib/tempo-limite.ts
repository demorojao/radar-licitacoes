/**
 * Embrulha um `fetch` para cancelar o pedido que passar de `ms` milissegundos. Sem isso, um banco
 * travado deixaria a página em "Carregando…" até a Vercel derrubar a função. Com o limite, o erro
 * chega ao `error.tsx`, que explica o que houve. Um cancelamento de quem chamou continua valendo.
 */
export function comTempoLimite(fetchBase: typeof fetch, ms: number): typeof fetch {
  return (entrada, init) => {
    const limite = AbortSignal.timeout(ms);
    const signal = init?.signal ? AbortSignal.any([init.signal, limite]) : limite;
    return fetchBase(entrada, { ...init, signal });
  };
}
