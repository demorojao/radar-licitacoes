import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";

import { FormularioDeBusca } from "@/componentes/FormularioDeBusca";
import { ItemDeLicitacao } from "@/componentes/ItemDeLicitacao";
import { Paginacao } from "@/componentes/Paginacao";
import { buscarContratacoes, opcoesDeFiltro, ultimaColeta } from "@/lib/banco";
import { formatarDataHora } from "@/lib/formatacao";
import { lerFiltros, linkDaPagina } from "@/lib/parametros";

const REPOSITORIO = "https://github.com/demorojao/radar-licitacoes";

// O título e o rodapé fazem parte do esqueleto estático. O que depende da URL e do banco chega
// por streaming dentro de <Suspense>, como pede o Cache Components do Next 16.
export default function Pagina({ searchParams }: PageProps<"/">) {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 sm:px-6">
      <header className="pt-10 pb-8 sm:pt-16 sm:pb-10">
        <h1 className="text-4xl font-extrabold tracking-tight sm:text-6xl">
          Radar de Licitações SC
        </h1>
        <p className="mt-3 max-w-2xl text-lg text-apagado">
          Licitações abertas em Santa Catarina, atualizadas todo dia a partir do Portal Nacional de
          Contratações Públicas.
        </p>
      </header>

      <main className="flex-1">
        <Suspense fallback={<Carregando />}>
          <Busca searchParams={searchParams} />
        </Suspense>
      </main>

      <footer className="mt-12 grid gap-1 border-t border-linha py-8 text-sm text-apagado">
        <Suspense fallback={null}>
          <UltimaColeta />
        </Suspense>
        <p>
          Projeto de portfólio com código aberto.{" "}
          <a
            href={REPOSITORIO}
            className="font-semibold text-verde underline underline-offset-4 hover:text-verde-forte"
          >
            Ver o código no GitHub
          </a>
        </p>
      </footer>
    </div>
  );
}

async function Busca({ searchParams }: Pick<PageProps<"/">, "searchParams">) {
  const filtros = lerFiltros(await searchParams);
  // A hora atual muda a cada visita: connection() avisa o Next para não usá-la no pré-render.
  await connection();
  const agora = new Date();
  const [resultado, opcoes] = await Promise.all([buscarContratacoes(filtros), opcoesDeFiltro()]);
  const temFiltro = linkDaPagina(filtros, 1) !== "/";

  return (
    <>
      {/* A key recria o formulário quando a URL muda, para os campos mostrarem a busca atual. */}
      <FormularioDeBusca key={linkDaPagina(filtros, 1)} filtros={filtros} opcoes={opcoes} />

      <div className="mt-10 flex flex-wrap items-baseline justify-between gap-2 pb-4">
        <p aria-live="polite" className="text-lg font-semibold">
          {resultado.total === 1
            ? "1 licitação aberta encontrada"
            : `${resultado.total.toLocaleString("pt-BR")} licitações abertas encontradas`}
        </p>
        {temFiltro && (
          <Link
            href="/"
            className="font-semibold text-verde underline underline-offset-4 hover:text-verde-forte"
          >
            Limpar busca e filtros
          </Link>
        )}
      </div>

      {resultado.total === 0 ? (
        <p className="border-t border-linha py-8 text-lg">
          Nenhuma licitação aberta com essa busca. Tente outra palavra ou tire um dos filtros.
        </p>
      ) : (
        <ol>
          {resultado.contratacoes.map((contratacao) => (
            <ItemDeLicitacao
              key={contratacao.numero_controle_pncp}
              contratacao={contratacao}
              agora={agora}
            />
          ))}
        </ol>
      )}

      <Paginacao
        filtros={filtros}
        pagina={resultado.pagina}
        totalDePaginas={resultado.totalDePaginas}
      />
    </>
  );
}

async function UltimaColeta() {
  // Dado do banco a cada visita: sem connection(), o Next tentaria lê-lo no build.
  await connection();
  const terminadaEm = await ultimaColeta();
  if (!terminadaEm) return <p>Ainda não houve coleta.</p>;
  const [data, hora] = formatarDataHora(terminadaEm).split(" ");
  return (
    <p>
      Dados públicos do PNCP, coletados pela última vez em {data} às {hora}.
    </p>
  );
}

function Carregando() {
  return (
    <p role="status" className="py-10 text-lg text-apagado">
      Carregando licitações…
    </p>
  );
}
