import Link from "next/link";

// Palavras do dia a dia que a busca entende por sinônimo (docs/sinonimos.md): o recrutador vê a
// diferença no primeiro clique.
const EXEMPLOS = ["remédio", "carro", "pneu", "festa", "computador"];

/** "Experimente: remédio, carro..." como links para a busca. */
export function Exemplos({ sobreFundoClaro = false }: { sobreFundoClaro?: boolean }) {
  const cor = sobreFundoClaro
    ? "text-verde decoration-verde/40 hover:text-verde-forte"
    : "text-sobre-faixa decoration-verde-vivo/60 hover:text-white focus-visible:outline-verde-vivo";
  return (
    <p className={`flex flex-wrap items-baseline gap-x-4 gap-y-1 ${sobreFundoClaro ? "" : "text-faixa-apagado"}`}>
      <span>Experimente:</span>
      {EXEMPLOS.map((palavra) => (
        <Link
          key={palavra}
          href={`/?q=${encodeURIComponent(palavra)}`}
          className={`font-semibold underline underline-offset-4 ${cor}`}
        >
          {palavra}
        </Link>
      ))}
    </p>
  );
}
