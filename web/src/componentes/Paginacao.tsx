import Link from "next/link";

import { type Filtros, linkDaPagina } from "@/lib/parametros";

const estiloDoLink = "font-semibold text-verde underline underline-offset-4 hover:text-verde-forte";

/** "‹ Anterior · Página X de Y · Próxima ›", mantendo os filtros na URL. */
export function Paginacao({
  filtros,
  pagina,
  totalDePaginas,
}: {
  filtros: Filtros;
  pagina: number;
  totalDePaginas: number;
}) {
  if (totalDePaginas <= 1) return null;
  return (
    <nav aria-label="Páginas" className="flex items-center justify-center gap-6 py-8">
      {pagina > 1 ? (
        <Link href={linkDaPagina(filtros, pagina - 1)} className={estiloDoLink}>
          ‹ Anterior
        </Link>
      ) : (
        <span aria-hidden className="text-apagado">
          ‹ Anterior
        </span>
      )}
      <span className="tabular-nums">
        Página {pagina} de {totalDePaginas}
      </span>
      {pagina < totalDePaginas ? (
        <Link href={linkDaPagina(filtros, pagina + 1)} className={estiloDoLink}>
          Próxima ›
        </Link>
      ) : (
        <span aria-hidden className="text-apagado">
          Próxima ›
        </span>
      )}
    </nav>
  );
}
