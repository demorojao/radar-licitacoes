import Link from "next/link";

import { type Dia, type Mes, rotuloDoDia } from "@/lib/calendario";
import { formatarDiaCurto } from "@/lib/formatacao";
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
  if (quantidade < 10) return "bg-verde/10";
  if (quantidade < 50) return "bg-verde/25";
  return "bg-verde/45";
}

/**
 * "Encerra a partir de": o mês com quantas licitações encerram em cada dia. Clicar no dia 15
 * mostra o que encerra do dia 15 em diante, em ordem de prazo (ADR 0010). Tudo é link, então dá
 * para mandar a busca por mensagem. No celular, o calendário fica recolhido para a lista aparecer
 * logo; no computador, fica aberto na barra lateral. Como são só links (nenhum campo de
 * formulário), as duas versões podem existir sem enviar nada em dobro.
 */
export function Calendario({ filtros, mes }: { filtros: Filtros; mes: Mes }) {
  const escolhida = filtros.aPartir ? `a partir de ${formatarDiaCurto(filtros.aPartir)}` : null;
  return (
    <>
      <details className="group rounded-lg border border-linha bg-superficie lg:hidden">
        <summary className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3 font-semibold">
          <span>Encerra {escolhida ?? "em qualquer data"}</span>
          <span aria-hidden className="text-apagado transition-transform group-open:rotate-180">
            ▾
          </span>
        </summary>
        <div className="border-t border-linha p-3">
          <PainelDoMes filtros={filtros} mes={mes} id="celular" />
        </div>
      </details>

      <section aria-labelledby="titulo-calendario" className="hidden gap-3 lg:grid">
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
          <PainelDoMes filtros={filtros} mes={mes} id="computador" />
        </div>
        <p className="text-xs text-apagado">
          O número pequeno é quantas encerram no dia. Clique para ver deste dia em diante.
        </p>
      </section>
    </>
  );
}

function PainelDoMes({ filtros, mes, id }: { filtros: Filtros; mes: Mes; id: string }) {
  const seta = "grid size-9 place-items-center rounded-md text-xl";
  const idDoMes = `mes-do-calendario-${id}`;
  return (
    <>
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
          <span aria-hidden className={`${seta} text-apagado/40`}>
            ‹
          </span>
        )}
        <p id={idDoMes} className="font-condensada text-xl font-bold first-letter:uppercase">
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

      <table
        className="w-full table-fixed border-separate border-spacing-0.5"
        aria-labelledby={idDoMes}
      >
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
      {filtros.aPartir && (
        <Link
          href={linkCom(filtros, { aPartir: undefined })}
          className="mt-3 block text-center text-sm font-semibold text-verde underline underline-offset-4 hover:text-verde-forte lg:hidden"
        >
          Qualquer data
        </Link>
      )}
    </>
  );
}

function CasaDoDia({ dia, filtros }: { dia: Dia; filtros: Filtros }) {
  const base = "grid aspect-square place-content-center rounded-md text-center leading-none";
  const numero = (
    <span
      className={`font-condensada text-lg font-bold ${dia.hoje ? "underline underline-offset-2" : ""}`}
    >
      {dia.numero}
    </span>
  );

  // Dia passado ou sem licitação: não há o que mostrar a partir dele.
  if (dia.passado || dia.quantidade === 0) {
    return (
      <span className={`${base} ${dia.passado ? "text-apagado/50" : "text-apagado"}`}>
        {numero}
      </span>
    );
  }

  return (
    <Link
      href={linkCom(filtros, { aPartir: dia.data, mes: dia.data.slice(0, 7) })}
      aria-label={rotuloDoDia(dia)}
      aria-current={dia.escolhido ? "true" : undefined}
      className={`${base} gap-0.5 hover:ring-2 hover:ring-verde/60 ${
        dia.escolhido
          ? "bg-verde text-superficie ring-2 ring-verde ring-offset-2 ring-offset-superficie"
          : `${calor(dia.quantidade)} text-tinta`
      }`}
    >
      {numero}
      <span className="text-[0.65rem] font-semibold tabular-nums opacity-80">
        {dia.quantidade}
      </span>
    </Link>
  );
}
