-- Sinônimos da busca: quem digita "remédio" também encontra "medicamento" (ADR 0009).
-- A lista, o critério de cada par e os descartados estão em docs/sinonimos.md.

-- 1. A tabela. `termo` é o que a pessoa digita; `equivalentes` são as palavras do edital.
--    As restrições recusam a linha inválida na hora de gravar, e não quebram a busca depois.
create table public.sinonimos (
  termo text primary key,
  equivalentes text[] not null,
  constraint sinonimos_termo_uma_palavra check (termo ~ '^[[:alpha:]]+$'),
  -- Recusa palavras que a busca ignora, como "de": elas viram uma consulta sem termos.
  constraint sinonimos_termo_buscavel check (
    numnode(
      websearch_to_tsquery('public.portugues_sem_acento', public.normalizar_para_busca(termo))
    ) = 1
  ),
  -- Ao menos um equivalente, cada um uma palavra só de letras.
  constraint sinonimos_equivalentes_palavras check (
    cardinality(equivalentes) > 0
    and array_position(equivalentes, null) is null
    and array_to_string(equivalentes, '|') ~ '^[[:alpha:]]+(\|[[:alpha:]]+)*$'
  )
);

comment on table public.sinonimos is
  'Sinônimos da busca: termo digitado → palavras do edital. Ver docs/sinonimos.md.';

alter table public.sinonimos enable row level security;

create policy "sinonimos: leitura pública"
  on public.sinonimos for select
  to anon, authenticated
  using (true);

-- 2. As consultas prontas para o ts_rewrite. A view só lê linhas que já passaram pelas
--    restrições, então o to_tsquery recebe só letras e "|". Com security_invoker, o RLS da
--    tabela vale também por aqui.
create view public.sinonimos_consulta
with (security_invoker = true) as
select
  termo,
  equivalentes,
  websearch_to_tsquery(
    'public.portugues_sem_acento', public.normalizar_para_busca(termo)
  ) as alvo,
  to_tsquery(
    'public.portugues_sem_acento',
    public.normalizar_para_busca(termo || ' | ' || array_to_string(equivalentes, ' | '))
  ) as substituto
from public.sinonimos;

revoke all on public.sinonimos_consulta from anon, authenticated;
grant select on public.sinonimos_consulta to anon, authenticated;

-- 3. A lista inicial, medida em 24/11/2026 (docs/sinonimos.md).
insert into public.sinonimos (termo, equivalentes) values
  ('adubo', '{fertilizante}'),
  ('aluguel', '{locação}'),
  ('asfalto', '{pavimentação}'),
  ('cachorro', '{canino,cão,cães}'),
  ('carro', '{veículo,automóvel,viatura}'),
  ('comida', '{alimentício,alimento}'),
  ('computador', '{informática,microcomputador,notebook,desktop}'),
  ('conserto', '{reparo,reparação}'),
  ('dentista', '{odontológico,odontológica,odontologia}'),
  ('eletricista', '{elétrica,elétrico}'),
  ('enfermeiro', '{enfermagem}'),
  ('festa', '{evento}'),
  ('fisioterapeuta', '{fisioterapia}'),
  ('impressora', '{impressão}'),
  ('jardinagem', '{roçada,paisagismo}'),
  ('limpeza', '{higienização,asseio,saneante}'),
  ('lixo', '{resíduo}'),
  ('luz', '{iluminação}'),
  ('moto', '{motocicleta}'),
  ('móveis', '{mobiliário}'),
  ('nutricionista', '{nutrição}'),
  ('padaria', '{panificação,panificados}'),
  ('papelaria', '{expediente}'),
  ('pedreiro', '{alvenaria}'),
  ('pintor', '{pintura}'),
  ('remédio', '{medicamento,fármaco}'),
  ('roupa', '{vestuário,fardamento}'),
  ('sapato', '{calçado}'),
  ('show', '{artístico,artística,musical}');

-- 4. A busca. O tipo de retorno ganha `sinonimos_usados`, e o `create or replace` não aceita
--    mudar o retorno: por isso a função é apagada e criada de novo, na mesma transação.
drop function public.buscar_contratacoes(text, text, integer, integer, integer);

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
    -- `q` é a mesma consulta com cada termo da tabela trocado por "termo OU equivalentes".
    -- O ts_rewrite mantém os operadores: aspas, "-palavra" e "or" continuam valendo.
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
  equivalentes as (
    -- Os equivalentes dos termos que a pessoa digitou, normalizados para conferir no objeto.
    select s.termo, e.palavra, e.ordem, public.normalizar_para_busca(e.palavra) as normalizada
    from consulta k
    join public.sinonimos_consulta s on k.original @> s.alvo
    cross join lateral unnest(s.equivalentes) with ordinality as e(palavra, ordem)
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
      k.q is not null and not c.busca @@ k.original as por_sinonimo
    from public.contratacoes c
    cross join consulta k
    where c.situacao_id = 1
      and c.data_encerramento_proposta > now()
      and (
        k.q is null
        or (
          c.busca @@ k.q
          and (
            c.busca @@ k.original
            -- Quem entra só pelo sinônimo precisa ter a palavra escrita no objeto, e não só o
            -- mesmo radical: "medicamento" e "médico" viram ambos "medic" (docs/sinonimos.md).
            or exists (
              select 1
              from equivalentes e
              where public.normalizar_para_busca(c.objeto) ~ ('\m' || e.normalizada)
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

grant execute on function public.buscar_contratacoes(text, text, integer, integer, integer)
  to anon, authenticated;
