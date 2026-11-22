# 0008. A busca do site é uma função SQL chamada com a chave pública

- Status: aceita
- Data: 2026-11-22

## Contexto

A primeira tela do site lista as licitações abertas com uma caixa "O que sua empresa vende?" e
filtros por município, modalidade e prazo. A busca precisa ignorar acentos e plurais, mostrar só
licitações realmente abertas e, numa etapa futura, combinar palavras com busca por significado
(embeddings). O site roda na Vercel em funções *serverless*, que ligam e desligam a cada visita.

## Decisão

A busca é uma **função SQL no Postgres**, `public.buscar_contratacoes`, criada por migration. Uma
segunda função, `public.opcoes_de_filtro`, monta as listas dos seletores. O servidor do site chama
as duas com o `@supabase/supabase-js` e a **chave pública** (*publishable*) do Supabase.

- As funções são `security invoker`: rodam com as permissões de quem chama, então o RLS continua
  valendo.
- `set search_path = ''` e nomes sempre qualificados, para nenhum objeto de outro schema tomar o
  lugar de uma tabela ou função.
- A busca por palavras usa uma coluna `tsvector` gerada pelo Postgres e uma configuração de busca
  em português sem acentos (`unaccent` + radical em português).

## Alternativas consideradas

- **Montar a consulta no TypeScript** (`.from('contratacoes').textSearch().eq()`). Exigiria menos
  SQL agora, mas a busca híbrida vai precisar de uma função SQL de qualquer jeito, e testar a
  lógica no TypeScript exigiria simular o banco.
- **O site conecta direto no Postgres**, como o coletor. A senha do banco teria que ir para a
  Vercel, com um usuário novo só de leitura, e funções *serverless* abririam muitas conexões.

## Consequências

- A lógica da busca é testada no CI pelos testes de integração que já existem (ADR 0007),
  inclusive como `anon`.
- Nenhum segredo vai para a Vercel: a chave pública só permite o que o RLS libera, que é a
  leitura.
- A busca por significado vai mudar a função, e não a tela.
- Mais SQL no projeto, que precisa ser revisado como código.
