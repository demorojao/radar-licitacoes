-- Correções da revisão da busca com sinônimos (24/11/2026).

-- 1. Plural em "-es". A regra da migration 20261124213736 tirava o "s" depois de qualquer vogal,
--    inclusive "e": "computadores" virava "computadore" e o radical ficava "computador", enquanto
--    "computador" fica "comput". Singular e plural se separaram ("escolares", "hospitalares",
--    "lugares", "mulheres"...). O Snowball já tira "-es" sozinho; a regra só precisa das outras
--    vogais: "pneus" → "pneu" e "obras" → "obra" continuam corrigidos.
create or replace function public.normalizar_para_busca(texto text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  -- Plurais irregulares mais comuns em objetos de licitação. As 3 letras mínimas antes da
  -- terminação protegem palavras curtas ("mais", "pais", "seis" ficam como estão).
  select
    regexp_replace(
    regexp_replace(regexp_replace(regexp_replace(regexp_replace(
    regexp_replace(regexp_replace(regexp_replace(
      lower(extensions.unaccent('extensions.unaccent'::regdictionary, coalesce(texto, ''))),
      '([a-z]{3,})oes\M', '\1ao', 'g'),   -- contratações → contratacao
      '([a-z]{3,})aes\M', '\1ao', 'g'),   -- capitães → capitao
      '([a-z]{3,})eis\M', '\1el', 'g'),   -- descartáveis → descartavel
      '([a-z]{3,})ais\M', '\1al', 'g'),   -- materiais → material
      '([a-z]{3,})ois\M', '\1ol', 'g'),   -- lençóis → lencol
      '([a-z]{3,})uis\M', '\1ul', 'g'),   -- pauis → paul
      '([a-z]{2,})ns\M', '\1m', 'g'),     -- itens → item
      '([a-z]{3,}[aiou])s\M', '\1', 'g')  -- pneus → pneu, obras → obra (sem "e": computadores)
$$;

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

-- 2. Cada equivalente é validado sozinho: só letras e uma palavra que a busca não ignora. A
--    restrição antiga juntava os equivalentes com "|" e aceitava '{a|b}' e '{de}'.
create function public.sinonimos_validos(palavras text[])
returns boolean
language sql
immutable
parallel safe
set search_path = ''
as $$
  select cardinality(palavras) > 0 and coalesce(bool_and(
    p is not null
    and p ~ '^[[:alpha:]]+$'
    and numnode(
      websearch_to_tsquery('public.portugues_sem_acento', public.normalizar_para_busca(p))
    ) = 1
  ), false)
  from unnest(palavras) p
$$;

alter table public.sinonimos
  drop constraint sinonimos_equivalentes_palavras,
  add constraint sinonimos_equivalentes_palavras check (public.sinonimos_validos(equivalentes));

-- 3. A conferência da palavra escrita passa a valer termo a termo. Antes, bastava UM equivalente
--    escrito no objeto, e os outros termos podiam bater só pelo radical: "remédio carro" trazia
--    "consultas médicas em veículo". Agora cada termo da busca só é trocado pelos equivalentes
--    que estão escritos naquele objeto; os outros continuam valendo só como foram digitados.
--    Vale também para a exclusão: "exame -remédio" não tira mais "exames médicos".
create function public.consulta_com_sinonimos_escritos(
  original tsquery,
  objeto_normalizado text,
  alvos tsquery[],
  termos text[],
  equivalentes text[]  -- os equivalentes de cada termo, juntados com "|"
)
returns tsquery
language plpgsql
stable
parallel safe
set search_path = ''
as $$
declare
  consulta tsquery := original;
  escritos text;
begin
  for i in 1 .. coalesce(cardinality(alvos), 0) loop
    select string_agg(e, ' | ')
      into escritos
      from unnest(string_to_array(equivalentes[i], '|')) as e
     where objeto_normalizado ~ ('\m' || public.normalizar_para_busca(e));
    if escritos is not null then
      consulta := ts_rewrite(
        consulta,
        alvos[i],
        to_tsquery(
          'public.portugues_sem_acento',
          public.normalizar_para_busca(termos[i] || ' | ' || escritos)
        )
      );
    end if;
  end loop;
  return consulta;
end
$$;

grant execute on function public.sinonimos_validos(text[]) to anon, authenticated;
grant execute on function public.consulta_com_sinonimos_escritos(tsquery, text, tsquery[], text[], text[])
  to anon, authenticated;

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
      k.original is not null and not c.busca @@ k.original as por_sinonimo
    from public.contratacoes c
    cross join consulta k
    cross join pares p
    where c.situacao_id = 1
      and c.data_encerramento_proposta > now()
      and (
        k.original is null
        or c.busca @@ case
          when p.alvos is null then k.original
          else public.consulta_com_sinonimos_escritos(
            k.original, public.normalizar_para_busca(c.objeto), p.alvos, p.termos, p.equivalentes
          )
        end
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
        where public.normalizar_para_busca(f.objeto) ~ ('\m' || e.normalizada)
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

-- 4. O drop da migration 20261124213008 apagou a descrição da função.
comment on function public.buscar_contratacoes is
  'Busca do site: licitações abertas, com texto, sinônimos, município, modalidade, prazo e página.';
