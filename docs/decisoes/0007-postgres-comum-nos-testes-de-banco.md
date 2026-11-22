# 0007. Postgres comum, imitando o Supabase, nos testes de banco

- Status: aceita
- Data: 2026-11-22

## Contexto

As migrations e o RLS precisam de testes num banco de verdade. O projeto Supabase gratuito é um só
e é o de produção, então não serve para testes. A máquina de desenvolvimento não tem Docker, e
subir o Supabase inteiro no CI (`supabase start`) leva vários contêineres e minutos a cada push.

## Decisão

O CI sobe um **Postgres 17 descartável** (a mesma versão do Supabase) como service container. Antes
das migrations, o script `coletor/tests/sql/simular_supabase.sql` cria os papéis `anon` e
`authenticated` e dá a eles permissão em todas as tabelas, como o Supabase faz. Assim, quem barra
a escrita nos testes é o RLS, e não a falta de permissão.

Os testes de integração são marcados com `@pytest.mark.integracao`. Sem `TEST_DATABASE_URL`, eles
são pulados com o motivo. No CI, `EXIGIR_BANCO_DE_TESTE=1` transforma essa falta em erro, para o CI
nunca passar com eles pulados.

## Alternativas consideradas

- **`supabase start` no CI.** Mais fiel (traz Auth, PostgREST e o resto), mas é pesado, e o
  coletor só precisa do Postgres.
- **Testar no projeto de produção.** Arriscado: um teste poderia apagar dados reais.

## Consequências

- Testes de banco rápidos e isolados, recriados do zero a cada execução.
- Na máquina de desenvolvimento eles aparecem como pulados. Quem não tem Docker depende do CI.
- Se o Supabase mudar as permissões padrão, `simular_supabase.sql` precisa acompanhar.
