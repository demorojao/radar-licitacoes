// A grade do calendário de encerramento: um mês de domingo a sábado. Função pura, sem relógio:
// quem chama informa "hoje" (no horário de Brasília), para o teste não depender da data.

export type Dia = {
  /** "AAAA-MM-DD" */
  data: string;
  numero: number;
  /** Quantas licitações encerram neste dia, com os filtros atuais. */
  quantidade: number;
  passado: boolean;
  hoje: boolean;
  escolhido: boolean;
};

export type Mes = {
  /** "dezembro de 2026" */
  titulo: string;
  /** Semanas de domingo a sábado; `null` nas casas antes do dia 1 e depois do último dia. */
  semanas: (Dia | null)[][];
  /** "AAAA-MM" do mês anterior, ou `null` se o mês é o atual (não há o que ver no passado). */
  anterior: string | null;
  proximo: string;
};

const nomeDoMes = new Intl.DateTimeFormat("pt-BR", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

const doisDigitos = (numero: number) => String(numero).padStart(2, "0");

/** "AAAA-MM" de um ano e um mês (1 a 12), corrigindo a virada do ano. */
function chaveDoMes(ano: number, mes: number): string {
  const data = new Date(Date.UTC(ano, mes - 1, 1));
  return `${data.getUTCFullYear()}-${doisDigitos(data.getUTCMonth() + 1)}`;
}

export function montarMes(
  mes: string,
  contagens: Map<string, number>,
  hoje: string,
  escolhido?: string,
): Mes {
  const [ano, numeroDoMes] = mes.split("-").map(Number);
  const primeiro = new Date(Date.UTC(ano, numeroDoMes - 1, 1));
  const diasNoMes = new Date(Date.UTC(ano, numeroDoMes, 0)).getUTCDate();

  const casas: (Dia | null)[] = Array.from({ length: primeiro.getUTCDay() }, () => null);
  for (let numero = 1; numero <= diasNoMes; numero++) {
    const data = `${mes}-${doisDigitos(numero)}`;
    casas.push({
      data,
      numero,
      quantidade: contagens.get(data) ?? 0,
      passado: data < hoje,
      hoje: data === hoje,
      escolhido: data === escolhido,
    });
  }
  while (casas.length % 7 !== 0) casas.push(null);

  const semanas: (Dia | null)[][] = [];
  for (let inicio = 0; inicio < casas.length; inicio += 7) {
    semanas.push(casas.slice(inicio, inicio + 7));
  }

  return {
    titulo: nomeDoMes.format(primeiro),
    semanas,
    anterior: mes <= hoje.slice(0, 7) ? null : chaveDoMes(ano, numeroDoMes - 1),
    proximo: chaveDoMes(ano, numeroDoMes + 1),
  };
}
