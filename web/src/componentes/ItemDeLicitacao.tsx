import type { Contratacao } from "@/lib/esquemas";
import {
  etiquetaDeSinonimos,
  formatarData,
  formatarDataHora,
  formatarValor,
  linkPncp,
  prazoRelativo,
  prazoSuspeito,
} from "@/lib/formatacao";

const CREDENCIAMENTO = 12;

/** Uma licitação da lista. O prazo vem primeiro: é o que decide se ainda dá tempo. */
export function ItemDeLicitacao({
  contratacao,
  agora,
}: {
  contratacao: Contratacao;
  agora: Date;
}) {
  const encerramento = contratacao.data_encerramento_proposta;
  const suspeito = prazoSuspeito(encerramento, agora);
  const prazo = prazoRelativo(encerramento, agora);
  const urgente = prazo === "encerra hoje" || prazo === "encerra amanhã";
  const valor = formatarValor(contratacao.valor_total_estimado);
  const etiqueta = etiquetaDeSinonimos(contratacao.sinonimos_usados);

  return (
    <li className="grid gap-3 border-t border-linha py-6 sm:grid-cols-[9.5rem_minmax(0,1fr)] sm:gap-6">
      <div className="grid content-start gap-0.5">
        {suspeito ? (
          <p className="text-sm text-apagado">
            Prazo informado: {formatarData(encerramento)} (provável erro no PNCP)
          </p>
        ) : (
          <>
            <p className="text-sm text-apagado">Encerra</p>
            <p
              className={`text-2xl leading-tight font-extrabold tracking-tight ${urgente ? "text-alerta" : "text-tinta"}`}
            >
              {/* "encerra em 3 dias" → "em 3 dias": o rótulo acima já diz "Encerra". */}
              {prazo.replace(/^encerra /, "")}
            </p>
            <p className="text-sm text-apagado tabular-nums">{formatarDataHora(encerramento)}</p>
          </>
        )}
      </div>

      <div className="grid min-w-0 gap-2">
        <p className="text-sm text-apagado">
          {contratacao.modalidade_nome}
          {contratacao.modalidade_id === CREDENCIAMENTO &&
            ": o órgão aceita fornecedores continuamente"}
        </p>
        <h2 className="line-clamp-3 text-lg leading-snug font-semibold">{contratacao.objeto}</h2>
        {/* Fica logo abaixo do objeto: explica por que um texto sem a palavra buscada apareceu. */}
        {etiqueta && (
          <p className="w-fit rounded-full bg-verde/10 px-2.5 py-0.5 text-sm font-semibold text-verde">
            {etiqueta}
          </p>
        )}
        <p className="text-sm text-apagado">
          {contratacao.orgao_razao_social}, {contratacao.municipio_nome}
        </p>
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 pt-1">
          <p
            className={
              valor === "Valor não informado" ? "text-apagado" : "font-bold tabular-nums"
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
      </div>
    </li>
  );
}
