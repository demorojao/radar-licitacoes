# 0002. Coletar só as contratações de SC com proposta aberta

- Status: aceita
- Data: 2026-11-18

## Contexto

O PNCP tem as contratações do país inteiro, de vários anos. Quem usa o Radar quer saber **em que
ainda dá para entrar**. O banco do plano gratuito do Supabase tem espaço limitado.

## Decisão

Usar o endpoint `/v1/contratacoes/proposta` da API de consulta, com `uf=SC` e um `dataFinal` bem
no futuro. Esse parâmetro significa "prazo de proposta encerra até", conforme
[docs/api-pncp.md](../api-pncp.md).

## Alternativas consideradas

- **`/v1/contratacoes/publicacao`, por data de publicação.** Exige uma chamada por modalidade e
  traz contratações já encerradas, que não interessam para o objetivo.
- **Todas as UFs.** O volume seria muitas vezes maior desde o início. Se fizer sentido, dá para
  expandir depois, porque a UF é só um parâmetro.

## Consequências

- Em 18/11/2026 eram cerca de 2,7 mil registros, ou seja, umas 54 páginas de 50. Recoletar tudo
  todo dia é barato e simples.
- O histórico de contratações encerradas não é coletado. O Radar é sobre oportunidades abertas.
- O coletor precisa aceitar dados sujos da fonte, como prazos depois do ano 2099.
