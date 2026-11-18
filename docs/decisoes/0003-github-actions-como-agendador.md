# 0003. GitHub Actions como agendador da coleta

- Status: aceita
- Data: 2026-11-18

## Contexto

A coleta precisa rodar sozinha uma vez por dia, sem servidor próprio e sem custo.

## Decisão

Um workflow agendado (cron) no GitHub Actions roda o coletor em Python. As chaves secretas ficam
nos secrets do repositório.

## Alternativas consideradas

- **Cron da Vercel.** O coletor teria de virar uma função serverless em JavaScript, com limite de
  tempo de execução.
- **Supabase (pg_cron e Edge Functions).** O coletor teria de ser reescrito em TypeScript para o
  Deno.
- **Servidor próprio.** Teria custo e daria manutenção.

## Consequências

- É gratuito em repositório público, e cada execução fica registrada com log na aba Actions.
- O GitHub avisa que execuções agendadas podem atrasar em horários de pico. Um atraso de minutos
  não importa aqui.
- Em repositório público, o GitHub **desativa workflows agendados depois de 60 dias sem atividade
  no repositório**. A tabela `coletas` e a página de status servem para perceber se a coleta parou.
- A atividade diária no banco também ajuda o projeto gratuito do Supabase a não ser pausado por
  inatividade.
