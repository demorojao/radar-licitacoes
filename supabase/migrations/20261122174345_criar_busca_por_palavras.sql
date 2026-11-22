-- Busca por palavras em português para o site, servida por funções SQL que o site chama com a
-- chave pública. Plano: docs/planos/2026-11-22-primeira-tela.md. Decisão: ADR 0008.

-- unaccent tira os acentos ("higienização" → "higienizacao"). O Supabase recomenda instalar
-- extensões no schema "extensions", fora do schema público.
create extension if not exists unaccent with schema extensions;

-- Cópia da configuração "portuguese" que tira os acentos antes de reduzir cada palavra ao radical
-- ("produtos" → "produt"). Assim a busca ignora acento e plural.
create text search configuration public.portugues_sem_acento (copy = pg_catalog.portuguese);
alter text search configuration public.portugues_sem_acento
  alter mapping for hword, hword_part, word
  with extensions.unaccent, pg_catalog.portuguese_stem;

-- Coluna calculada pelo próprio Postgres a cada insert e update: o coletor não precisa mudar.
-- O objeto pesa mais (A) que o nome do órgão (B) na relevância.
alter table public.contratacoes
  add column busca tsvector generated always as (
    setweight(to_tsvector('public.portugues_sem_acento', objeto), 'A')
    || setweight(to_tsvector('public.portugues_sem_acento', orgao_razao_social), 'B')
  ) stored;

create index contratacoes_busca_idx on public.contratacoes using gin (busca);

-- A busca do site. Devolve só licitações abertas: situação 1 ("Divulgada no PNCP") e prazo
-- futuro. 20 por página, com o total encontrado e a página efetiva em cada linha.
-- security invoker: roda com as permissões de quem chama, então o RLS continua valendo.
-- search_path vazio: nenhum nome pode ser sequestrado por um objeto de outro schema.
create function public.buscar_contratacoes(
  p_texto text default null,
  p_codigo_ibge text default null,
  p_modalidade_id integer default null,
  p_prazo_dias integer default null,
  p_pagina integer default 1
)
returns table (
  numero_controle_pncp text,
  objeto text,
  orgao_razao_social text,
  municipio_nome text,
  modalidade_id integer,
  modalidade_nome text,
  valor_total_estimado text,
  data_encerramento_proposta timestamptz,
  cnpj_orgao text,
  ano_compra integer,
  sequencial_compra integer,
  total bigint,
  pagina integer
)
language sql
stable
security invoker
set search_path = ''
as $$
  with consulta as (
    -- websearch_to_tsquery aceita qualquer texto sem erro de sintaxe. Um texto sem termos
    -- ("de", "!!!") vira uma consulta vazia, tratada como busca sem texto.
    select case when numnode(bruta.q) = 0 then null else bruta.q end as q
    from (
      select websearch_to_tsquery('public.portugues_sem_acento', coalesce(p_texto, '')) as q
    ) bruta
  ),
  filtradas as (
    select
      c.numero_controle_pncp,
      c.objeto,
      c.orgao_razao_social,
      c.municipio_nome,
      c.modalidade_id,
      c.modalidade_nome,
      c.valor_total_estimado,
      c.data_encerramento_proposta,
      c.cnpj_orgao,
      c.ano_compra,
      c.sequencial_compra,
      case when k.q is null then 0 else ts_rank(c.busca, k.q) end as relevancia
    from public.contratacoes c
    cross join consulta k
    where c.situacao_id = 1
      and c.data_encerramento_proposta > now()
      and (k.q is null or c.busca @@ k.q)
      and (p_codigo_ibge is null or c.codigo_ibge = p_codigo_ibge)
      and (p_modalidade_id is null or c.modalidade_id = p_modalidade_id)
      and (
        p_prazo_dias is null
        or c.data_encerramento_proposta <= now() + make_interval(days => p_prazo_dias)
      )
  ),
  pagina_efetiva as (
    -- Uma página além da última mostra a última; zero ou negativa mostra a primeira.
    select
      t.total,
      least(greatest(coalesce(p_pagina, 1), 1), greatest(ceil(t.total / 20.0)::integer, 1))
        as numero
    from (select count(*) as total from filtradas) t
  )
  select
    f.numero_controle_pncp,
    f.objeto,
    f.orgao_razao_social,
    f.municipio_nome,
    f.modalidade_id,
    f.modalidade_nome,
    f.valor_total_estimado::text,
    f.data_encerramento_proposta,
    f.cnpj_orgao,
    f.ano_compra,
    f.sequencial_compra,
    p.total,
    p.numero
  from filtradas f
  cross join pagina_efetiva p
  order by f.relevancia desc, f.data_encerramento_proposta, f.numero_controle_pncp
  limit 20
  offset (select (numero - 1) * 20 from pagina_efetiva)
$$;

comment on function public.buscar_contratacoes is
  'Busca do site: licitações abertas, com texto, município, modalidade, prazo e página.';

-- Municípios e modalidades que têm licitação aberta agora, para os seletores do site.
create function public.opcoes_de_filtro()
returns table (tipo text, valor text, nome text, quantidade bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  with abertas as (
    select c.codigo_ibge, c.municipio_nome, c.modalidade_id, c.modalidade_nome
    from public.contratacoes c
    where c.situacao_id = 1 and c.data_encerramento_proposta > now()
  )
  select 'modalidade', a.modalidade_id::text, a.modalidade_nome, count(*)
  from abertas a
  group by a.modalidade_id, a.modalidade_nome
  union all
  select 'municipio', a.codigo_ibge, a.municipio_nome, count(*)
  from abertas a
  group by a.codigo_ibge, a.municipio_nome
  order by 1, 3
$$;

comment on function public.opcoes_de_filtro is
  'Municípios e modalidades com licitação aberta, com a contagem, para os filtros do site.';

grant execute on function public.buscar_contratacoes to anon, authenticated;
grant execute on function public.opcoes_de_filtro to anon, authenticated;
