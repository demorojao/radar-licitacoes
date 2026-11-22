-- Recria num Postgres comum os papéis e as permissões que o Supabase já traz prontos.
-- No Supabase, anon (público) e authenticated (com login) recebem permissão em todas as tabelas
-- do schema public; quem barra a escrita é o RLS. Sem isto, um teste de RLS passaria pelo motivo
-- errado ("sem permissão na tabela" em vez de "bloqueado pela política").
do $$
begin
  if not exists (select from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
end
$$;

grant usage on schema public to anon, authenticated;
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant all on sequences to anon, authenticated;

-- No Supabase, as extensões ficam no schema "extensions", que anon e authenticated podem usar.
create schema if not exists extensions;
grant usage on schema extensions to anon, authenticated;
