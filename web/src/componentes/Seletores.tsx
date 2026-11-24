import { SeletorQueEnvia } from "@/componentes/SeletorQueEnvia";
import type { OpcoesDeFiltro } from "@/lib/esquemas";
import type { Filtros } from "@/lib/parametros";

const campo =
  "h-11 w-full rounded-md border border-linha bg-superficie px-3 text-base text-tinta hover:border-verde";

/** Município e modalidade, na barra lateral. Pertencem ao formulário da busca (`form="busca"`). */
export function Seletores({ filtros, opcoes }: { filtros: Filtros; opcoes: OpcoesDeFiltro }) {
  return (
    <fieldset className="grid grid-cols-2 gap-3 lg:grid-cols-1 lg:gap-4">
      <legend className="sr-only">Filtros</legend>
      <label className="grid gap-1.5 text-sm font-semibold">
        Município
        <SeletorQueEnvia
          form="busca"
          name="municipio"
          valor={filtros.municipio ?? ""}
          className={campo}
        >
          <option value="">Todos</option>
          {opcoes.municipios.map((opcao) => (
            <option key={opcao.valor} value={opcao.valor}>
              {opcao.nome} ({opcao.quantidade})
            </option>
          ))}
        </SeletorQueEnvia>
      </label>
      <label className="grid gap-1.5 text-sm font-semibold">
        Modalidade
        <SeletorQueEnvia
          form="busca"
          name="modalidade"
          valor={filtros.modalidade?.toString() ?? ""}
          className={campo}
        >
          <option value="">Todas</option>
          {opcoes.modalidades.map((opcao) => (
            <option key={opcao.valor} value={opcao.valor}>
              {opcao.nome} ({opcao.quantidade})
            </option>
          ))}
        </SeletorQueEnvia>
      </label>
    </fieldset>
  );
}
