import Link from "next/link";

import type { OpcoesDeFiltro } from "@/lib/esquemas";
import { formatarDiaCurto } from "@/lib/formatacao";
import { type Filtros, linkCom } from "@/lib/parametros";

/** Quantas licitações a busca achou e o que está filtrado, com um "×" para tirar cada filtro. */
export function ResumoDosFiltros({
  filtros,
  opcoes,
  total,
}: {
  filtros: Filtros;
  opcoes: OpcoesDeFiltro;
  total: number;
}) {
  const nomeDe = (lista: { valor: string; nome: string }[], valor?: string) =>
    lista.find((opcao) => opcao.valor === valor)?.nome ?? valor;

  const ativos: { texto: string; sem: string }[] = [];
  if (filtros.q) ativos.push({ texto: `“${filtros.q}”`, sem: linkCom(filtros, { q: undefined }) });
  if (filtros.municipio) {
    ativos.push({
      texto: `em ${nomeDe(opcoes.municipios, filtros.municipio)}`,
      sem: linkCom(filtros, { municipio: undefined }),
    });
  }
  if (filtros.modalidade !== undefined) {
    ativos.push({
      texto: nomeDe(opcoes.modalidades, String(filtros.modalidade)) ?? "",
      sem: linkCom(filtros, { modalidade: undefined }),
    });
  }
  if (filtros.aPartir) {
    ativos.push({
      texto: `encerram a partir de ${formatarDiaCurto(filtros.aPartir)}`,
      sem: linkCom(filtros, { aPartir: undefined }),
    });
  }

  return (
    <div className="grid gap-3 border-b border-linha pb-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p aria-live="polite" className="flex items-baseline gap-2">
          <span className="font-condensada text-5xl leading-none font-bold tabular-nums">
            {total.toLocaleString("pt-BR")}
          </span>
          <span className="text-lg font-semibold">
            {total === 1 ? "licitação aberta" : "licitações abertas"}
          </span>
        </p>
        {ativos.length > 0 && (
          <Link
            href="/"
            className="font-semibold text-verde underline underline-offset-4 hover:text-verde-forte"
          >
            Limpar tudo
          </Link>
        )}
      </div>
      {ativos.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="Filtros ativos">
          {ativos.map((ativo) => (
            <li key={ativo.sem}>
              <Link
                href={ativo.sem}
                className="inline-flex items-center gap-2 rounded-full border border-linha bg-superficie py-1 pr-2 pl-3 text-sm font-semibold hover:border-verde"
              >
                {ativo.texto}
                <span aria-hidden className="text-apagado">
                  ×
                </span>
                <span className="sr-only">(tirar este filtro)</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
