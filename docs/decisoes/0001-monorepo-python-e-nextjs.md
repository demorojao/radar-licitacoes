# 0001. Monorepo com coletor em Python e site em Next.js

- Status: aceita
- Data: 2026-11-18

## Contexto

O sistema faz dois trabalhos bem diferentes:

- **Coleta:** rodar uma vez por dia, percorrer as páginas de uma API, validar e gravar milhares de
  registros e, mais adiante, ler PDFs.
- **Site:** responder rápido a pessoas, com busca, filtros e uma interface caprichada.

## Decisão

Um único repositório (monorepo) com duas pastas: `coletor/` em Python e `web/` em Next.js com
TypeScript. As duas partes só conversam pelo banco de dados, e as migrations do banco são o
contrato entre elas.

## Alternativas consideradas

- **Tudo em Python com Streamlit.** É mais simples e usa uma linguagem só. Foi descartada porque a
  interface fica com cara de painel interno, e o objetivo é um produto que uma empresa usaria.
- **Tudo em TypeScript.** Também usa uma linguagem só. Foi descartada porque, para dados e leitura
  de PDF, o ecossistema do Python é mais maduro, e o projeto quer mostrar as duas pilhas.
- **Dois repositórios.** Cada parte ficaria isolada. Foi descartada porque uma mudança no banco
  afeta as duas partes e deve ser revisada num commit só.

## Consequências

- Duas ferramentas de build (uv e npm) e um CI com dois jobs.
- Regras de qualidade equivalentes nas duas pastas: lint, checagem de tipos e testes.
- As mudanças de banco ficam num lugar só e servem às duas partes.
