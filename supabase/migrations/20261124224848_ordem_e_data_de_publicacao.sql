-- Data de publicação e ordenação (docs/planos/2026-11-24-publicacao-e-ordem.md). A busca devolve
-- `data_publicacao` e aceita `p_ordem`: 'prazo', 'relevancia', 'recentes' ou 'antigas'. A
-- assinatura muda, então a função é apagada e criada de novo na mesma transação; os parâmetros de
-- antes continuam valendo, para o site no ar não quebrar antes do merge.

drop function public.buscar_contratacoes(text, text, integer, integer, integer, date);

create function public.buscar_contratacoes(
  p_texto text default null,
  p_codigo_ibge text default null,
  p_modalidade_id integer default null,
  p_prazo_dias integer default null,
  p_pagina integer default 1,
  p_encerra_a_partir date default null,
  p_ordem text default null
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
  pagina integer,
  sinonimos_usados text[],
  data_publicacao timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  with filtradas as (
    select
      c.numero_controle_pncp,
      c.objeto,
      c.orgao_razao_social,
      c.municipio_nome,
      c.modalidade_id,
      c.modalidade_nome,
      c.valor_total_estimado,
      c.data_encerramento_proposta,
      c.data_publicacao,
      c.cnpj_orgao,
      c.ano_compra,
      c.sequencial_compra,
      c.objeto_normalizado,
      b.relevancia,
      b.por_sinonimo
    from public.contratacoes_que_batem(p_texto, p_codigo_ibge, p_modalidade_id) b
    join public.contratacoes c on c.numero_controle_pncp = b.numero_controle_pncp
    where (
        p_prazo_dias is null
        or c.data_encerramento_proposta <= now() + make_interval(days => p_prazo_dias)
      )
      -- "A partir do dia 15" começa às 00:00 do dia 15 em Brasília.
      and (
        p_encerra_a_partir is null
        or c.data_encerramento_proposta
          >= (p_encerra_a_partir::timestamp at time zone 'America/Sao_Paulo')
      )
  ),
  -- A ordem pedida; desconhecida ou vazia vira o padrão: prazo quando há data no calendário,
  -- senão relevância (que, sem texto, empata e cai no prazo).
  ordem as (
    select case
      when p_ordem in ('prazo', 'relevancia', 'recentes', 'antigas') then p_ordem
      when p_encerra_a_partir is not null then 'prazo'
      else 'relevancia'
    end as valor
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
    p.numero,
    case
      when f.por_sinonimo then public.sinonimos_usados(p_texto, f.objeto_normalizado)
      else '{}'::text[]
    end,
    f.data_publicacao
  from filtradas f
  cross join pagina_efetiva p
  cross join ordem o
  -- Cada ordem liga um critério; os outros dão null e não pesam. Sem data de publicação, a
  -- licitação vai para o fim nas duas ordens por publicação. O prazo desempata sempre.
  order by
    case when o.valor = 'recentes' then f.data_publicacao end desc nulls last,
    case when o.valor = 'antigas' then f.data_publicacao end asc nulls last,
    case when o.valor = 'relevancia' then f.relevancia end desc,
    f.data_encerramento_proposta,
    f.relevancia desc,
    f.numero_controle_pncp
  limit 20
  offset (select (numero - 1) * 20 from pagina_efetiva)
$$;

comment on function public.buscar_contratacoes is
  'Busca do site: licitações abertas, com texto, sinônimos, filtros, data, ordem e página.';

grant execute on function public.buscar_contratacoes(text, text, integer, integer, integer, date, text)
  to anon, authenticated;
