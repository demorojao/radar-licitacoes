import { connection } from "next/server";
import { Suspense } from "react";

import { Cabecalho } from "@/componentes/Cabecalho";
import { Calendario } from "@/componentes/Calendario";
import { Exemplos } from "@/componentes/Exemplos";
import { FormularioDeBusca } from "@/componentes/FormularioDeBusca";
import { ItemDeLicitacao } from "@/componentes/ItemDeLicitacao";
import { Paginacao } from "@/componentes/Paginacao";
import { ResumoDosFiltros } from "@/componentes/ResumoDosFiltros";
import { Seletores } from "@/componentes/Seletores";
import {
  buscarContratacoes,
  encerramentosPorDia,
  opcoesDeFiltro,
  ultimaColeta,
} from "@/lib/banco";
import { mesDoCalendario, montarMes } from "@/lib/calendario";
import { formatarDataHora, hojeEmBrasilia } from "@/lib/formatacao";
import { lerFiltros, linkDaPagina } from "@/lib/parametros";

const REPOSITORIO = "https://github.com/demorojao/radar-licitacoes";
const LARGURA = "mx-auto w-full max-w-6xl px-4 sm:px-6";

// A barra do topo e o rodapé fazem parte do esqueleto estático. O que depende da URL e do banco
// chega por streaming dentro de <Suspense>, como pede o Cache Components do Next 16.
export default function Pagina({ searchParams }: PageProps<"/">) {
  return (
    <div className="flex flex-1 flex-col">
      <Cabecalho
        numeros={
          <Suspense fallback={null}>
            <NumerosVivos />
          </Suspense>
        }
      />
      {/* A lista chega por streaming e um pequeno script a coloca na página: sem JavaScript, ela
          não aparece. Melhor dizer isso do que deixar "Carregando…" para sempre. */}
      <noscript>
        <p className={`${LARGURA} py-6 text-lg font-semibold`}>
          O Radar precisa de JavaScript para mostrar as licitações. Ative o JavaScript do navegador e
          recarregue a página.
        </p>
      </noscript>
      <Suspense fallback={<Carregando />}>
        <Conteudo searchParams={searchParams} />
      </Suspense>
      <footer className="mt-auto border-t border-linha">
        <div className={`${LARGURA} grid gap-1 py-8 text-sm text-apagado`}>
          <p>Dados públicos do Portal Nacional de Contratações Públicas (PNCP).</p>
          <p>
            Projeto de portfólio com código aberto.{" "}
            <a
              href={REPOSITORIO}
              className="font-semibold text-verde underline underline-offset-4 hover:text-verde-forte"
            >
              Ver o código no GitHub
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}

async function Conteudo({ searchParams }: Pick<PageProps<"/">, "searchParams">) {
  const parametros = await searchParams;
  // A hora atual muda a cada visita: connection() avisa o Next para não usá-la no pré-render.
  await connection();
  const agora = new Date();
  const hoje = hojeEmBrasilia(agora);
  const filtros = lerFiltros(parametros, hoje);
  const mes = mesDoCalendario(filtros, hoje);

  const [resultado, opcoes, contagens] = await Promise.all([
    buscarContratacoes(filtros),
    opcoesDeFiltro(),
    encerramentosPorDia(filtros, mes),
  ]);

  return (
    <>
      <div className="bg-verde-profundo text-sobre-faixa">
        <div className={LARGURA}>
          {/* A key recria o formulário quando a URL muda, para os campos mostrarem a busca atual. */}
          <FormularioDeBusca key={linkDaPagina(filtros, 1)} filtros={filtros} />
        </div>
      </div>

      <div
        className={`${LARGURA} grid grid-cols-[minmax(0,1fr)] gap-10 py-8 sm:py-10 lg:grid-cols-[18rem_minmax(0,1fr)] lg:items-start`}
      >
        {/* Quem usa teclado não precisa passar pelos filtros e pelos 31 dias para chegar à lista. */}
        <a
          href="#resultados"
          className="sr-only focus:not-sr-only focus:w-fit focus:rounded-md focus:bg-superficie focus:px-3 focus:py-2 focus:font-semibold lg:col-span-2"
        >
          Ir para os resultados
        </a>
        <aside className="grid gap-6 lg:sticky lg:top-6 lg:gap-8" aria-label="Filtros e calendário">
          <Seletores filtros={filtros} opcoes={opcoes} />
          <Calendario filtros={filtros} mes={montarMes(mes, contagens, hoje, filtros.aPartir)} />
        </aside>

        <main id="resultados" className="min-w-0">
          <h2 className="sr-only">Resultados</h2>
          <ResumoDosFiltros filtros={filtros} opcoes={opcoes} total={resultado.total} />

          {resultado.total === 0 ? (
            <div className="grid gap-4 py-10">
              <p className="text-2xl font-bold">Nenhuma licitação aberta com essa busca.</p>
              <p className="text-lg text-apagado">
                Tente outra palavra, escolha uma data mais cedo no calendário ou tire um filtro.
              </p>
              <Exemplos sobreFundoClaro />
            </div>
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
        </main>
      </div>
    </>
  );
}

/** "2.672 licitações abertas agora · atualizado em 24/11 às 06:07". */
async function NumerosVivos() {
  // Dados do banco a cada visita: sem connection(), o Next tentaria lê-los no build.
  await connection();
  const [opcoes, terminadaEm] = await Promise.all([opcoesDeFiltro(), ultimaColeta()]);
  const abertas = opcoes.municipios.reduce((soma, opcao) => soma + opcao.quantidade, 0);
  const atualizado = terminadaEm ? formatarDataHora(terminadaEm).split(" ") : null;
  return (
    <p className="flex flex-wrap gap-x-4 gap-y-1">
      <span>
        <strong className="font-condensada text-lg text-white tabular-nums">
          {abertas.toLocaleString("pt-BR")}
        </strong>{" "}
        licitações abertas agora
      </span>
      {atualizado && (
        <span>
          atualizado em {atualizado[0].slice(0, 5)} às {atualizado[1]}
        </span>
      )}
    </p>
  );
}

function Carregando() {
  return (
    <>
      <div className="bg-verde-profundo">
        <div className={`${LARGURA} grid gap-5 py-10 sm:py-14`}>
          <p className="text-3xl font-extrabold tracking-tight text-white sm:text-5xl">
            O que sua empresa vende?
          </p>
          <div className="h-16 rounded-lg bg-white/10" />
        </div>
      </div>
      <p role="status" className={`${LARGURA} py-10 text-lg text-apagado`}>
        Carregando licitações…
      </p>
    </>
  );
}
