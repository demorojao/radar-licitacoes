# 0006. O coletor grava no Postgres com SQL direto (psycopg)

- Status: aceita
- Data: 2026-11-22

## Contexto

O coletor grava cerca de 2.700 contratações por dia. A gravação precisa ser atômica (tudo ou
nada), não pode duplicar registros e precisa contar quantos eram novos e quantos foram
atualizados. O Supabase oferece duas formas de escrever no banco: a API REST (PostgREST, usada
pelo cliente `supabase-py`) e a conexão Postgres comum.

## Decisão

Conexão Postgres comum com o **psycopg 3**, a biblioteca Postgres mais usada no Python, com SQL
escrito à mão: `INSERT ... ON CONFLICT ... DO UPDATE` dentro de uma transação.

A conexão de produção usa o **Session pooler** do Supabase, porque a conexão direta do plano
gratuito só funciona em IPv6, e o GitHub Actions não tem IPv6. O pooler aceita IPv4.

## Alternativas consideradas

- **Cliente REST do Supabase (`supabase-py`).** Mais simples de começar, mas cada chamada é uma
  requisição HTTP isolada: sem transação envolvendo várias operações e sem acesso direto ao
  `ON CONFLICT` e aos detalhes da contagem.
- **ORM (SQLAlchemy).** Útil em sistemas com muitas tabelas e regras. Aqui são poucas tabelas e
  consultas simples, e o SQL direto fica mais fácil de ler e explicar.

## Consequências

- Os testes de integração rodam contra um Postgres comum (ver ADR 0007).
- O SQL fica explícito no código e precisa ser revisado como código.
- A URL de conexão (com senha) é um segredo: fica no `.env` e nos secrets do GitHub.
