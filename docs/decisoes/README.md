# Registro de decisões (ADRs)

Um ADR (Architecture Decision Record) registra uma decisão técnica: o contexto, o que foi
decidido, as alternativas consideradas e as consequências. Serve para quem chega ao projeto
entender **por que** o sistema é assim, e não só **como**.

Um ADR não é apagado quando a decisão muda. Escreve-se um novo, que substitui o antigo.

| Nº | Decisão | Status |
|---|---|---|
| [0001](0001-monorepo-python-e-nextjs.md) | Monorepo com coletor em Python e site em Next.js | aceita |
| [0002](0002-somente-propostas-abertas-de-sc.md) | Coletar só as contratações de SC com proposta aberta | aceita |
| [0003](0003-github-actions-como-agendador.md) | GitHub Actions como agendador da coleta | aceita |
| [0004](0004-uv-no-projeto-python.md) | uv para gerenciar o projeto Python | aceita |
| [0005](0005-respeitar-o-limite-de-uso-da-api.md) | Respeitar o limite de uso da API do PNCP | aceita |
| [0006](0006-sql-direto-com-psycopg.md) | O coletor grava no Postgres com SQL direto (psycopg) | aceita |
| [0007](0007-postgres-comum-nos-testes-de-banco.md) | Postgres comum, imitando o Supabase, nos testes de banco | aceita |

## Modelo

~~~markdown
# NNNN. Título

- Status: proposta | aceita | substituída por NNNN
- Data: AAAA-MM-DD

## Contexto
## Decisão
## Alternativas consideradas
## Consequências
~~~
