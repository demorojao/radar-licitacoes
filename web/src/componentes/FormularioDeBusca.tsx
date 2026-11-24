import Form from "next/form";

import type { OpcoesDeFiltro } from "@/lib/esquemas";
import type { Filtros } from "@/lib/parametros";

const campo =
  "h-11 w-full rounded-md border border-linha bg-superficie px-3 text-base text-tinta";

/**
 * Busca e filtros num formulário GET: os valores vão para a URL (`/?q=...`), então dá para
 * mandar uma busca por link, e funciona até sem JavaScript.
 */
export function FormularioDeBusca({
  filtros,
  opcoes,
}: {
  filtros: Filtros;
  opcoes: OpcoesDeFiltro;
}) {
  return (
    <Form action="/" className="grid gap-5">
      <div className="grid gap-2">
        <label htmlFor="q" className="text-xl font-semibold">
          O que sua empresa vende?
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            id="q"
            name="q"
            type="search"
            defaultValue={filtros.q ?? ""}
            placeholder="Ex.: material de limpeza, pneus, merenda escolar"
            maxLength={200}
            className="h-14 w-full rounded-md border-2 border-tinta bg-superficie px-4 text-lg text-tinta placeholder:text-apagado"
          />
          <button
            type="submit"
            className="h-14 shrink-0 rounded-md bg-verde px-7 text-lg font-semibold text-superficie hover:bg-verde-forte"
          >
            Buscar
          </button>
        </div>
      </div>

      <fieldset className="grid gap-3 sm:grid-cols-2">
        <legend className="sr-only">Filtros</legend>
        <label className="grid gap-1 text-sm font-semibold">
          Município
          <select name="municipio" defaultValue={filtros.municipio ?? ""} className={campo}>
            <option value="">Todos</option>
            {opcoes.municipios.map((opcao) => (
              <option key={opcao.valor} value={opcao.valor}>
                {opcao.nome} ({opcao.quantidade})
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm font-semibold">
          Modalidade
          <select
            name="modalidade"
            defaultValue={filtros.modalidade?.toString() ?? ""}
            className={campo}
          >
            <option value="">Todas</option>
            {opcoes.modalidades.map((opcao) => (
              <option key={opcao.valor} value={opcao.valor}>
                {opcao.nome} ({opcao.quantidade})
              </option>
            ))}
          </select>
        </label>
      </fieldset>
    </Form>
  );
}
