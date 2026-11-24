-- A busca com sinônimos levava 1,2 s com três termos que têm sinônimo (contra 17 ms de uma busca
-- comum), medido em produção em 24/11/2026. Duas causas: o objeto passava pelas 8 trocas de
-- `normalizar_para_busca` em toda linha, a cada busca; e a conferência termo a termo rodava para
-- todas as linhas. Correção: o objeto normalizado vira uma coluna gerada (calculada ao gravar), e
-- sem exclusão a conferência só olha quem já bate com a consulta ampliada.

alter table public.contratacoes
  add column objeto_normalizado text
  generated always as (public.normalizar_para_busca(objeto)) stored;

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
  pagina integer,
  sinonimos_usados text[]
)
language sql
stable
security invoker
set search_path = ''
as $$
  with consulta as (
    -- `original` é o que a pessoa digitou (um texto sem termos, como "de", vira null).
    -- `q` troca cada termo da tabela por "termo OU todos os equivalentes"; serve para ordenar.
    select
      o.original,
      -- Sem exclusão ("-palavra"), a conferência termo a termo só precisa olhar quem já bate com
      -- a consulta ampliada `q`: o resultado é o mesmo, e a busca fica muito mais rápida.
      position('!' in coalesce(o.original::text, '')) > 0 as tem_exclusao,
      case
        when o.original is null then null
        else ts_rewrite(o.original, 'select alvo, substituto from public.sinonimos_consulta')
      end as q
    from (
      select case when numnode(bruta.q) = 0 then null else bruta.q end as original
      from (
        select websearch_to_tsquery(
          'public.portugues_sem_acento', public.normalizar_para_busca(p_texto)
        ) as q
      ) bruta
    ) o
  ),
  -- Os sinônimos dos termos que a pessoa digitou.
  relevantes as (
    select s.termo, s.alvo, s.equivalentes
    from consulta k
    join public.sinonimos_consulta s on k.original @> s.alvo
  ),
  pares as (
    select
      array_agg(r.alvo order by r.termo) as alvos,
      array_agg(r.termo order by r.termo) as termos,
      array_agg(array_to_string(r.equivalentes, '|') order by r.termo) as equivalentes
    from relevantes r
  ),
  equivalentes as (
    select r.termo, e.palavra, e.ordem, public.normalizar_para_busca(e.palavra) as normalizada
    from relevantes r
    cross join lateral unnest(r.equivalentes) with ordinality as e(palavra, ordem)
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
      case when k.q is null then 0 else ts_rank(c.busca, k.q) end as relevancia,
      k.original is not null and not c.busca @@ k.original as por_sinonimo,
      c.objeto_normalizado
    from public.contratacoes c
    cross join consulta k
    cross join pares p
    where c.situacao_id = 1
      and c.data_encerramento_proposta > now()
      and (
        k.original is null
        or (p.alvos is null and c.busca @@ k.original)
        or (
          p.alvos is not null
          and (k.tem_exclusao or c.busca @@ k.q)
          and (
            (not k.tem_exclusao and c.busca @@ k.original)
            or c.busca @@ public.consulta_com_sinonimos_escritos(
              k.original, c.objeto_normalizado, p.alvos, p.termos, p.equivalentes
            )
          )
        )
      )
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
    p.numero,
    -- A etiqueta: os equivalentes escritos no objeto, só para quem entrou pelo sinônimo.
    case
      when f.por_sinonimo then array(
        select e.palavra
        from equivalentes e
        where f.objeto_normalizado ~ ('\m' || e.normalizada)
        order by e.termo, e.ordem
      )
      else '{}'::text[]
    end
  from filtradas f
  cross join pagina_efetiva p
  order by f.relevancia desc, f.data_encerramento_proposta, f.numero_controle_pncp
  limit 20
  offset (select (numero - 1) * 20 from pagina_efetiva)
$$;
