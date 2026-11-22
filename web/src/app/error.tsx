"use client"; // Error boundaries precisam ser Client Components.

import { useEffect } from "react";

// Aparece se o banco falhar (Supabase fora do ar ou pausado) ou se a resposta vier num formato
// inesperado. A página não quebra: explica o que houve e oferece tentar de novo.
export default function Erro({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-4 px-4 py-16 sm:px-6">
      <h1 className="text-3xl font-extrabold tracking-tight">
        Não foi possível carregar as licitações agora
      </h1>
      <p className="max-w-2xl text-lg text-apagado">
        O banco de dados não respondeu. Tente de novo em alguns instantes.
      </p>
      <button
        type="button"
        onClick={() => retry()}
        className="h-12 w-fit rounded-md bg-verde px-6 font-semibold text-superficie hover:bg-verde-forte"
      >
        Tentar de novo
      </button>
    </div>
  );
}
