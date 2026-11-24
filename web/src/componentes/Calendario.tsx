import Link from "next/link";

import type { Dia, Mes } from "@/lib/calendario";
import { type Filtros, linkCom } from "@/lib/parametros";

const DIAS_DA_SEMANA = [
  ["D", "domingo"],
  ["S", "segunda"],
  ["T", "terça"],
  ["Q", "quarta"],
  ["Q", "quinta"],
  ["S", "sexta"],
  ["S", "sábado"],
] as const;

/** Quanto mais licitações encerram no dia, mais forte o verde. */
function calor(quantidade: number): string {
  if (quantidade === 0) return "";
  if (quantidade < 10) return "bg-verde/10";
  if (quantidade < 50) return "bg-verde/25";
  return "bg-verde/45";
}

function rotulo(dia: Dia): string {
  const quantas =
    dia.quantidade === 1 ? "1 licitação encerra" : `${dia.quantidade} licitações encerram`;
  return `${dia.numero}: ${quantas}. Ver a partir deste dia.`;
}

/**
 * "Encerra a partir de": o mês com quantas licitações encerram em cada dia. Clicar no dia 15
 * mostra o que encerra do dia 15 em diante, em ordem de prazo (ADR 0010). Tudo é link, então
 * dá para mandar a busca por mensagem.
 */
export function Calendario({ filtros, mes }: { filtros: Filtros; mes: Mes }) {
  const seta = "grid size-9 place-items-center rounded-md text-xl";
  return (
    <section aria-labelledby="titulo-calendario" className="grid gap-3">
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="titulo-calendario" className="text-sm font-semibold">
          Encerra a partir de
        </h2>
        {filtros.aPartir && (
          <Link
            href={linkCom(filtros, { aPartir: undefined })}
            className="text-sm font-semibold text-verde underline underline-offset-4 hover:text-verde-forte"
          >
            Qualquer data
          </Link>
        )}
      </div>

      <div className="rounded-lg border border-linha bg-superficie p-3">
        <div className="mb-2 flex items-center justify-between">
          {mes.anterior ? (
            <Link
              href={linkCom(filtros, { mes: mes.anterior })}
              aria-label="Mês anterior"
              className={`${seta} hover:bg-verde-claro`}
            >
              ‹
            </Link>
          ) : (
            <span aria-hidden className={`${seta} text-linha`}>
              ‹
            </span>
          )}
          <p className="font-condensada text-xl font-bold first-letter:uppercase" id="mes-do-calendario">
            {mes.titulo}
          </p>
          <Link
            href={linkCom(filtros, { mes: mes.proximo })}
            aria-label="Próximo mês"
            className={`${seta} hover:bg-verde-claro`}
          >
            ›
          </Link>
        </div>

        <table className="w-full table-fixed border-separate border-spacing-0.5" aria-labelledby="mes-do-calendario">
          <thead>
            <tr>
              {DIAS_DA_SEMANA.map(([letra, nome]) => (
                <th key={nome} scope="col" className="pb-1 text-xs font-semibold text-apagado">
                  <abbr title={nome} className="no-underline">
                    {letra}
                  </abbr>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {mes.semanas.map((semana, indice) => (
              <tr key={indice}>
                {semana.map((dia, coluna) => (
                  <td key={dia?.data ?? `vazio-${coluna}`} className="p-0">
                    {dia && <CasaDoDia dia={dia} filtros={filtros} />}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-apagado">
        O número pequeno é quantas encerram no dia. Clique para ver deste dia em diante.
      </p>
    </section>
  );
}

function CasaDoDia({ dia, filtros }: { dia: Dia; filtros: Filtros }) {
  const base = "grid aspect-square place-content-center rounded-md text-center leading-none";
  const numero = (
    <span className={`font-condensada text-lg font-bold ${dia.hoje ? "underline underline-offset-2" : ""}`}>
      {dia.numero}
    </span>
  );

  if (dia.passado || dia.quantidade === 0) {
    return (
      <span className={`${base} ${dia.passado ? "text-linha" : "text-apagado"}`}>
        {numero}
      </span>
    );
  }

  return (
    <Link
      href={linkCom(filtros, { aPartir: dia.data, mes: dia.data.slice(0, 7) })}
      aria-label={rotulo(dia)}
      aria-current={dia.escolhido ? "date" : undefined}
      className={`${base} ${calor(dia.quantidade)} gap-0.5 text-tinta hover:ring-2 hover:ring-verde/60 ${
        dia.escolhido ? "bg-verde! text-superficie! ring-2 ring-verde ring-offset-2 ring-offset-superficie" : ""
      }`}
    >
      {numero}
      <span className="text-[0.65rem] font-semibold tabular-nums opacity-80">{dia.quantidade}</span>
    </Link>
  );
}
