// Regras de exibição. Tudo no horário de Brasília: o servidor da Vercel roda em UTC.
const FUSO = "America/Sao_Paulo";
const UM_DIA_EM_MS = 86_400_000;

const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

const dataHora = new Intl.DateTimeFormat("pt-BR", {
  timeZone: FUSO,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function partesEmBrasilia(data: Date): Record<string, string> {
  return Object.fromEntries(
    dataHora.formatToParts(data).map((parte) => [parte.type, parte.value]),
  );
}

/** Valor em reais. O banco manda texto ("258930.70"), formatado sem passar por float. */
export function formatarValor(valor: string | null): string {
  if (valor === null || Number(valor) === 0) return "Valor não informado";
  return moeda.format(valor as `${number}`);
}

/** "25/11/2026 23:30", no horário de Brasília. */
export function formatarDataHora(iso: string): string {
  const p = partesEmBrasilia(new Date(iso));
  return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}`;
}

/** "25/11/2026", no horário de Brasília. */
export function formatarData(iso: string): string {
  return formatarDataHora(iso).slice(0, 10);
}

/** Número do dia do calendário de Brasília em que a data cai. */
function diaEmBrasilia(data: Date): number {
  const p = partesEmBrasilia(data);
  return Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day)) / UM_DIA_EM_MS;
}

/** "encerra hoje", "encerra amanhã", "encerra em 3 dias" ou "encerra em 3 meses". */
export function prazoRelativo(iso: string, agora: Date): string {
  const dias = diaEmBrasilia(new Date(iso)) - diaEmBrasilia(agora);
  if (dias <= 0) return "encerra hoje";
  if (dias === 1) return "encerra amanhã";
  if (dias < 60) return `encerra em ${dias} dias`;
  return `encerra em ${Math.floor(dias / 30)} meses`;
}

/** "AAAA-MM-DD" de hoje no horário de Brasília. */
export function hojeEmBrasilia(agora: Date): string {
  const p = partesEmBrasilia(agora);
  return `${p.year}-${p.month}-${p.day}`;
}

/**
 * Quão perto está o fim do prazo: "agora" para hoje e amanhã (quase não dá mais tempo),
 * "semana" para os próximos 7 dias, e null depois disso.
 */
export function urgencia(iso: string, agora: Date): "agora" | "semana" | null {
  const dias = diaEmBrasilia(new Date(iso)) - diaEmBrasilia(agora);
  if (dias <= 1) return "agora";
  if (dias <= 7) return "semana";
  return null;
}

/** "2026-12-15" → "15/12". */
export function formatarDiaCurto(data: string): string {
  const [, mes, dia] = data.split("-");
  return `${dia}/${mes}`;
}

/** Prazo a mais de 5 anos: quase sempre erro de digitação do órgão no PNCP. */
export function prazoSuspeito(iso: string, agora: Date): boolean {
  const limite = new Date(agora);
  limite.setUTCFullYear(limite.getUTCFullYear() + 5);
  return new Date(iso) > limite;
}

/** Página da licitação no portal oficial do PNCP. */
export function linkPncp(contratacao: {
  cnpj_orgao: string;
  ano_compra: number;
  sequencial_compra: number;
}): string {
  const { cnpj_orgao, ano_compra, sequencial_compra } = contratacao;
  return `https://pncp.gov.br/app/editais/${cnpj_orgao}/${ano_compra}/${sequencial_compra}`;
}

const lista = new Intl.ListFormat("pt-BR", { style: "long", type: "conjunction" });

/** Explica por que a licitação apareceu, quando ela entrou só por sinônimo. */
export function etiquetaDeSinonimos(sinonimos: string[]): string | null {
  if (sinonimos.length === 0) return null;
  const rotulo = sinonimos.length === 1 ? "pelo sinônimo" : "pelos sinônimos";
  return `Encontrada ${rotulo} ${lista.format(sinonimos)}`;
}
