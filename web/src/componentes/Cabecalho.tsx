import Link from "next/link";
import type { ReactNode } from "react";

/** A marca: um radar com o setor de varredura e um ponto âmbar, a licitação encontrada. */
export function Marca({ className = "size-9" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={className}>
      <g fill="none" stroke="currentColor" strokeOpacity=".4" strokeWidth="1.5">
        <circle cx="16" cy="16" r="14" />
        <circle cx="16" cy="16" r="9" />
        <circle cx="16" cy="16" r="4" />
      </g>
      <path d="M16 16 L16 2 A14 14 0 0 1 29.31 11.67 Z" fill="currentColor" fillOpacity=".3" />
      <line x1="16" y1="16" x2="16" y2="2" stroke="currentColor" strokeWidth="2" />
      <circle cx="21.8" cy="9.1" r="2.2" fill="#fdb022" />
    </svg>
  );
}

/** Barra do topo: marca, nome e os números vivos (que chegam por streaming). */
export function Cabecalho({ numeros }: { numeros: ReactNode }) {
  return (
    <header className="bg-verde-profundo text-sobre-faixa">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b border-white/10 px-4 py-4 sm:px-6">
        <Link href="/" className="flex items-center gap-3 focus-visible:outline-verde-vivo">
          <Marca />
          <h1 className="text-lg font-extrabold tracking-tight text-white sm:text-xl">
            Radar de Licitações SC
          </h1>
        </Link>
        <div className="text-sm text-faixa-apagado">{numeros}</div>
      </div>
    </header>
  );
}
