-- Calendário de encerramento (ADR 0010). O filtro "até N dias" destacava o que está mais
-- apertado; quem vende precisa do contrário: ver o que encerra de um dia em diante, para ter tempo
-- de se preparar. A regra de "quais licitações batem" vira uma função interna, usada pela busca e
-- pela contagem por dia: assim a regra dos sinônimos fica num lugar só.

-- 1. Quais licitações abertas batem com o texto (e os sinônimos), o município e a modalidade.
create function public.contratacoes_que_batem(
  p_texto text default null,
  p_codigo_ibge text default null,
  p_modalidade_id integer default null
)
returns table (numero_controle_pncp text, relevancia real, por_sinonimo boolean)
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
  pares as (
    select
      array_agg(s.alvo order by s.termo) as alvos,
      array_agg(s.termo order by s.termo) as termos,
      array_agg(array_to_string(s.equivalentes, '|') order by s.termo) as equivalentes
    from consulta k
    join public.sinonimos_consulta s on k.original @> s.alvo
  )
  select
    c.numero_controle_pncp,
    case when k.q is null then 0::real else ts_rank(c.busca, k.q) end,
    k.original is not null and not c.busca @@ k.original
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
          -- Quem entra pelo sinônimo precisa ter a palavra escrita no objeto, termo a termo.
          or c.busca @@ public.consulta_com_sinonimos_escritos(
            k.original, c.objeto_normalizado, p.alvos, p.termos, p.equivalentes
          )
        )
      )
    )
    and (p_codigo_ibge is null or c.codigo_ibge = p_codigo_ibge)
    and (p_modalidade_id is null or c.modalidade_id = p_modalidade_id)
$$;

comment on function public.contratacoes_que_batem is
  'Interna: licitações abertas que batem com texto (e sinônimos), município e modalidade.';

-- 2. A etiqueta: os equivalentes que estão escritos no objeto.
create function public.sinonimos_usados(p_texto text, p_objeto_normalizado text)
returns text[]
language sql
stable
security invoker
set search_path = ''
as $$
  select array(
    select e.palavra
    from public.sinonimos_consulta s
    cross join lateral unnest(s.equivalentes) with ordinality as e(palavra, ordem)
    where websearch_to_tsquery(
        'public.portugues_sem_acento', public.normalizar_para_busca(p_texto)
      ) @> s.alvo
      and p_objeto_normalizado ~ ('\m' || public.normalizar_para_busca(e.palavra))
    order by s.termo, e.ordem
  )
$$;

-- 3. A busca ganha `p_encerra_a_partir`. A assinatura muda, então a função é apagada e criada de
--    novo na mesma transação. `p_prazo_dias` continua funcionando: o site que está no ar ainda o
--    usa, e ele sai numa etapa futura.
drop function public.buscar_contratacoes(text, text, integer, integer, integer);

create function public.buscar_contratacoes(
  p_texto text default null,
  p_codigo_ibge text default null,
  p_modalidade_id integer default null,
  p_prazo_dias integer default null,
  p_pagina integer default 1,
  p_encerra_a_partir date default null
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
    end
  from filtradas f
  cross join pagina_efetiva p
  -- Com data escolhida, a ordem é pelo prazo: as do dia escolhido vêm primeiro. Sem data,
  -- continua pela relevância e depois pelo prazo.
  order by
    case when p_encerra_a_partir is null then f.relevancia else 0 end desc,
    f.data_encerramento_proposta,
    f.relevancia desc,
    f.numero_controle_pncp
  limit 20
  offset (select (numero - 1) * 20 from pagina_efetiva)
$$;

comment on function public.buscar_contratacoes is
  'Busca do site: licitações abertas, com texto, sinônimos, município, modalidade, data e página.';

-- 4. Quantas licitações encerram em cada dia do mês de `p_mes`, no horário de Brasília.
create function public.encerramentos_por_dia(
  p_texto text default null,
  p_codigo_ibge text default null,
  p_modalidade_id integer default null,
  p_mes date default null
)
returns table (dia date, quantidade bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  with mes as (
    select date_trunc(
      'month',
      coalesce(p_mes, (now() at time zone 'America/Sao_Paulo')::date)::timestamp
    )::date as inicio
  )
  select
    (c.data_encerramento_proposta at time zone 'America/Sao_Paulo')::date,
    count(*)
  from public.contratacoes_que_batem(p_texto, p_codigo_ibge, p_modalidade_id) b
  join public.contratacoes c on c.numero_controle_pncp = b.numero_controle_pncp
  cross join mes m
  where (c.data_encerramento_proposta at time zone 'America/Sao_Paulo')::date
    between m.inicio and (m.inicio + interval '1 month' - interval '1 day')::date
  group by 1
  order by 1
$$;

comment on function public.encerramentos_por_dia is
  'Calendário do site: quantas licitações (com os mesmos filtros da busca) encerram em cada dia.';

grant execute on function public.contratacoes_que_batem(text, text, integer) to anon, authenticated;
grant execute on function public.sinonimos_usados(text, text) to anon, authenticated;
grant execute on function public.buscar_contratacoes(text, text, integer, integer, integer, date)
  to anon, authenticated;
grant execute on function public.encerramentos_por_dia(text, text, integer, date)
  to anon, authenticated;
