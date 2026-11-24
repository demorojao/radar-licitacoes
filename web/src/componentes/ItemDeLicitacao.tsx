import type { Contratacao } from "@/lib/esquemas";
import {
  etiquetaDeSinonimos,
  formatarData,
  formatarDataHora,
  formatarValor,
  linkPncp,
  prazoRelativo,
  prazoSuspeito,
  urgencia,
} from "@/lib/formatacao";

const CREDENCIAMENTO = 12;

// A faixa lateral diz quanto tempo resta: vermelho para hoje e amanhã, âmbar para a semana.
const FAIXA = { agora: "border-alerta", semana: "border-ambar" } as const;
const COR_DO_PRAZO = { agora: "text-alerta", semana: "text-ambar" } as const;

/** Uma licitação da lista. O prazo vem primeiro, grande: é o que decide se ainda dá tempo. */
export function ItemDeLicitacao({
  contratacao,
  agora,
}: {
  contratacao: Contratacao;
  agora: Date;
}) {
  const encerramento = contratacao.data_encerramento_proposta;
  const suspeito = prazoSuspeito(encerramento, agora);
  const nivel = suspeito ? null : urgencia(encerramento, agora);
  const prazo = prazoRelativo(encerramento, agora);
  const valor = formatarValor(contratacao.valor_total_estimado);
  const etiqueta = etiquetaDeSinonimos(contratacao.sinonimos_usados);

  return (
    <li
      className={`grid gap-3 border-b border-l-4 border-b-linha py-6 pl-4 sm:grid-cols-[9.5rem_minmax(0,1fr)] sm:gap-6 lg:grid-cols-[9.5rem_minmax(0,1fr)_auto] ${
        nivel ? FAIXA[nivel] : "border-l-transparent"
      }`}
    >
      <div className="grid content-start gap-0.5">
        {suspeito ? (
          <p className="text-sm text-apagado">
            Prazo informado: {formatarData(encerramento)} (provável erro no PNCP)
          </p>
        ) : (
          <>
            <p className="text-sm text-apagado">Encerra</p>
            <p
              className={`font-condensada text-3xl leading-none font-bold ${nivel ? COR_DO_PRAZO[nivel] : "text-tinta"}`}
            >
              {/* "encerra em 3 dias" → "em 3 dias": o rótulo acima já diz "Encerra". */}
              {prazo.replace(/^encerra /, "")}
            </p>
            <p className="pt-1 text-sm text-apagado tabular-nums">
              {formatarDataHora(encerramento)}
            </p>
          </>
        )}
      </div>

      <div className="grid min-w-0 content-start gap-2">
        <p className="text-sm text-apagado">
          {contratacao.modalidade_nome}
          {contratacao.modalidade_id === CREDENCIAMENTO &&
            ": o órgão aceita fornecedores continuamente"}
        </p>
        {/* overflow-wrap: anywhere quebra "hidráulica,retroescavadeira,..." sem esticar a página. */}
        <h3 className="line-clamp-3 text-lg leading-snug font-semibold [overflow-wrap:anywhere]">{contratacao.objeto}</h3>
        {/* Fica logo abaixo do objeto: explica por que um texto sem a palavra buscada apareceu. */}
        {etiqueta && (
          <p className="w-fit rounded-full bg-verde-claro px-2.5 py-0.5 text-sm font-semibold text-verde">
            {etiqueta}
          </p>
        )}
        <p className="text-sm text-apagado">
          {contratacao.orgao_razao_social}, {contratacao.municipio_nome}
        </p>
        {contratacao.data_publicacao && (
          <p className="text-sm text-apagado">
            Publicada em{" "}
            <time dateTime={contratacao.data_publicacao}>
              {formatarData(contratacao.data_publicacao)}
            </time>
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 sm:col-start-2 lg:col-start-3 lg:grid lg:content-start lg:justify-items-end lg:gap-2 lg:text-right">
        <p
          className={
            valor === "Valor não informado"
              ? "text-sm text-apagado"
              : "font-condensada text-2xl leading-none font-bold tabular-nums"
          }
        >
          {valor}
        </p>
        <a
          href={linkPncp(contratacao)}
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-verde underline underline-offset-4 hover:text-verde-forte"
        >
          Ver no PNCP ↗<span className="sr-only"> (abre em outra aba)</span>
        </a>
      </div>
    </li>
  );
}
