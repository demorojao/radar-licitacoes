import Form from "next/form";

import { Exemplos } from "@/componentes/Exemplos";
import type { Filtros } from "@/lib/parametros";

/**
 * A busca, na faixa verde do topo. É um formulário GET (`/?q=...`): dá para mandar uma busca por
 * link. Os seletores da barra lateral fazem parte deste mesmo
 * formulário pelo atributo `form="busca"`, e a data escolhida no calendário vai junto, escondida.
 */
export function FormularioDeBusca({ filtros }: { filtros: Filtros }) {
  return (
    <Form id="busca" action="/" className="grid gap-5 py-10 sm:py-14">
      <div className="grid gap-3">
        <label
          htmlFor="q"
          className="max-w-3xl text-3xl leading-tight font-extrabold tracking-tight text-white sm:text-5xl"
        >
          O que sua empresa vende?
        </label>
        <p className="max-w-2xl text-base text-faixa-apagado sm:text-lg">
          Licitações abertas em Santa Catarina, atualizadas todo dia a partir do Portal Nacional de
          Contratações Públicas. A busca entende a palavra do dia a dia.
        </p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          id="q"
          name="q"
          type="search"
          defaultValue={filtros.q ?? ""}
          placeholder="Ex.: material de limpeza, pneus, remédio"
          maxLength={200}
          className="h-16 w-full rounded-lg bg-superficie px-5 text-lg text-tinta ring-1 ring-white/15 placeholder:text-apagado focus-visible:outline-verde-vivo"
        />
        <button
          type="submit"
          className="h-16 shrink-0 rounded-lg bg-verde-vivo px-9 text-lg font-bold text-verde-profundo hover:bg-white focus-visible:outline-white"
        >
          Buscar
        </button>
      </div>

      {filtros.aPartir && <input type="hidden" name="a_partir" value={filtros.aPartir} />}
      {filtros.mes && <input type="hidden" name="mes" value={filtros.mes} />}

      <Exemplos />
    </Form>
  );
}
