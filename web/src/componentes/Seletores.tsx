import { SeletorQueEnvia } from "@/componentes/SeletorQueEnvia";
import type { OpcoesDeFiltro } from "@/lib/esquemas";
import type { Filtros, Ordem } from "@/lib/parametros";

const NOMES_DAS_ORDENS: Record<Ordem, string> = {
  prazo: "Prazo mais próximo",
  relevancia: "Mais relevantes",
  recentes: "Publicadas recentemente",
  antigas: "Publicadas há mais tempo",
};

const campo =
  "h-11 w-full rounded-md border border-linha bg-superficie px-3 text-base text-tinta hover:border-verde";

/** Município, modalidade e ordem, na barra lateral. Pertencem ao formulário da busca (`form="busca"`). */
export function Seletores({ filtros, opcoes }: { filtros: Filtros; opcoes: OpcoesDeFiltro }) {
  // Sem escolha, o banco usa o padrão: relevância com texto (sem data no calendário), senão prazo.
  const ordemPadrao: Ordem = filtros.q && !filtros.aPartir ? "relevancia" : "prazo";
  const ordem = filtros.ordem ?? ordemPadrao;
  // "Mais relevantes" só faz sentido com texto na busca.
  const ordens = (Object.keys(NOMES_DAS_ORDENS) as Ordem[]).filter(
    (opcao) => opcao !== "relevancia" || filtros.q || ordem === "relevancia",
  );
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
      <label className="col-span-2 grid gap-1.5 text-sm font-semibold lg:col-span-1">
        Ordenar por
        <SeletorQueEnvia form="busca" name="ordem" valor={ordem} className={campo}>
          {ordens.map((opcao) => (
            <option key={opcao} value={opcao}>
              {NOMES_DAS_ORDENS[opcao]}
            </option>
          ))}
        </SeletorQueEnvia>
      </label>
    </fieldset>
  );
}
