# 0010. Calendário "encerra a partir de" no lugar do filtro "até N dias"

- Status: aceita
- Data: 2026-11-24

## Contexto

A primeira tela tinha o filtro "Encerra em: até 7, 30 ou 90 dias". Ele destacava justamente as
licitações mais apertadas. O João levantou o problema: quem vende 1.000 máquinas de lavar não
consegue preparar proposta, documentos e estoque para algo que encerra hoje. A pergunta de quem
vende é outra: "até que dia eu consigo me preparar, e o que ainda dá tempo?".

Na tela, o filtro também parecia quebrado. Escolher a opção não fazia nada até clicar em
"Buscar". E, sem texto, a lista já vem ordenada pelo prazo, então a primeira página com "até 7
dias" era idêntica à sem filtro. Em 24/11/2026 eram 2.672 licitações sem filtro e 773 com
"até 7 dias".

## Decisão

Um **calendário** do mês, com quantas licitações encerram em cada dia. Clicar no dia 15 mostra o
que encerra **do dia 15 em diante** (opção escolhida pelo João). Quando há uma data escolhida, a
lista é ordenada pelo prazo, para as do dia 15 virem primeiro.

- O dia é sempre o de Brasília: "a partir do dia 15" começa às 00:00 do dia 15 em Brasília.
- A regra de "quais licitações batem" (texto, sinônimos, município, modalidade e só as abertas)
  virou a função interna `contratacoes_que_batem`, usada por `buscar_contratacoes` e por
  `encerramentos_por_dia`. Assim, as contagens do calendário batem com a lista.
- `buscar_contratacoes` mantém `p_prazo_dias` por compatibilidade: o site que estava no ar ainda o
  usava quando a migration foi aplicada. Ele sai numa etapa futura.

## Alternativas consideradas

- **Só o dia exato** (clicar no 15 mostra só o 15). É o comportamento comum de calendário, mas a
  pessoa perde as dos dias seguintes se não clicar em cada um.
- **Intervalo de datas** ("de 10 a 20"). Pode vir depois; "a partir de" já responde à pergunta de
  quem vende.
- **Manter "até N dias" e só aplicar ao escolher.** Corrigiria o "parece quebrado", mas continuaria
  destacando o que não dá tempo de preparar.

## Consequências

- O calendário e a lista vêm da mesma regra, com teste de que as contagens batem.
- Uma consulta a mais por visita (a contagem do mês), que roda junto com a busca.
- O parâmetro antigo fica no banco até a próxima limpeza.
