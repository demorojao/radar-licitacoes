-- O radical do português (Snowball) não tira o "s" do plural de toda palavra: "pneus" fica
-- "pneus" e "pneu" fica "pneu", então buscar "pneu" não achava "Aquisição de pneus". O mesmo com
-- "obras" e "obra". Medido em 24/11/2026: "pneu" achava 2 licitações abertas e passa a achar 19;
-- "obra" passa de 274 para 341.
-- Correção: depois das regras de plural que já existiam, tirar o "s" final depois de vogal. Como
-- a mesma função trata o texto guardado e o buscado, os dois lados ficam sempre iguais. As 3
-- letras mínimas antes da vogal protegem palavras curtas ("mais", "dos", "gás").

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
      '([a-z]{3,}[aeiou])s\M', '\1', 'g') -- pneus → pneu, obras → obra
$$;

-- Recalcula a coluna da busca: o Postgres não refaz uma coluna gerada quando a função muda.
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
