-- O radical do português (Snowball) reconhece "-ção/-ções" e "-ável/-áveis" pela forma com
-- acento. Como a busca tira os acentos antes do radical, singular e plural viravam radicais
-- diferentes: "contratação" achava 1.217 licitações e "contratações" só 10 (medido em 22/11/2026).
-- Correção: tirar o acento e trocar a terminação do plural pela do singular ANTES do radical,
-- do mesmo jeito no texto guardado e no texto buscado.

-- unaccent() é "stable" e uma coluna gerada só aceita funções "immutable". Chamar a forma com
-- o dicionário explícito dentro de uma função immutable é o caminho que a documentação do
-- unaccent indica para índices e colunas geradas.
create function public.normalizar_para_busca(texto text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  -- Plurais irregulares mais comuns em objetos de licitação. As 3 letras mínimas antes da
  -- terminação protegem palavras curtas ("mais", "pais", "seis" ficam como estão).
  select
    regexp_replace(regexp_replace(regexp_replace(regexp_replace(
    regexp_replace(regexp_replace(regexp_replace(
      lower(extensions.unaccent('extensions.unaccent'::regdictionary, coalesce(texto, ''))),
      '([a-z]{3,})oes\M', '\1ao', 'g'),   -- contratações → contratacao
      '([a-z]{3,})aes\M', '\1ao', 'g'),   -- capitães → capitao
      '([a-z]{3,})eis\M', '\1el', 'g'),   -- descartáveis → descartavel
      '([a-z]{3,})ais\M', '\1al', 'g'),   -- materiais → material
      '([a-z]{3,})ois\M', '\1ol', 'g'),   -- lençóis → lencol
      '([a-z]{3,})uis\M', '\1ul', 'g'),   -- pauis → paul
      '([a-z]{2,})ns\M', '\1m', 'g')      -- itens → item
$$;

comment on function public.normalizar_para_busca is
  'Tira acentos e troca a terminação do plural pela do singular, antes do radical da busca.';

grant execute on function public.normalizar_para_busca to anon, authenticated;

-- Recalcula a coluna da busca com o texto normalizado (Postgres 17: SET EXPRESSION).
alter table public.contratacoes
  alter column busca set expression as (
    setweight(
      to_tsvector('public.portugues_sem_acento', public.normalizar_para_busca(objeto)), 'A'
    )
    || setweight(
      to_tsvector('public.portugues_sem_acento', public.normalizar_para_busca(orgao_razao_social)),
      'B'
    )
  );

-- A busca normaliza o texto digitado do mesmo jeito.
create or replace function public.buscar_contratacoes(
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
      select websearch_to_tsquery(
        'public.portugues_sem_acento', public.normalizar_para_busca(p_texto)
      ) as q
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
