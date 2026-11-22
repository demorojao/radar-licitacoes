-- Contratações (licitações) com proposta aberta coletadas do PNCP e o registro de cada coleta.
-- Plano aprovado em 22/11/2026. Ver docs/arquitetura.md.

create table public.contratacoes (
  numero_controle_pncp text primary key
    check (numero_controle_pncp ~ '^\d{14}-\d+-\d{6}/\d{4}$'),
  cnpj_orgao text not null check (cnpj_orgao ~ '^\d{14}$'),
  orgao_razao_social text not null,
  ano_compra integer not null,
  sequencial_compra integer not null,
  numero_compra text,
  processo text,
  objeto text not null,
  informacao_complementar text,
  modalidade_id integer not null,
  modalidade_nome text not null,
  modo_disputa_nome text,
  situacao_id integer not null,
  situacao_nome text not null,
  srp boolean,
  -- numeric é decimal exato: dinheiro nunca vira float.
  valor_total_estimado numeric(18, 2),
  valor_total_homologado numeric(18, 2),
  data_publicacao timestamptz,
  data_abertura_proposta timestamptz,
  data_encerramento_proposta timestamptz not null,
  data_atualizacao_pncp timestamptz,
  uf text not null check (uf ~ '^[A-Z]{2}$'),
  municipio_nome text not null,
  codigo_ibge text not null check (codigo_ibge ~ '^\d{7}$'),
  unidade_nome text,
  link_sistema_origem text,
  -- Resposta original da API, para reprocessar sem baixar de novo.
  payload jsonb not null,
  primeira_coleta_em timestamptz not null default now(),
  -- Uma contratação que sai da lista de abertas não é apagada: só para de ser atualizada.
  ultima_coleta_em timestamptz not null default now()
);

comment on table public.contratacoes is
  'Licitações com proposta aberta publicadas no PNCP. Gravadas pelo coletor com upsert.';

-- Os filtros da tela: prazo, município, modalidade e situação.
create index contratacoes_encerramento_idx on public.contratacoes (data_encerramento_proposta);
create index contratacoes_municipio_idx on public.contratacoes (codigo_ibge);
create index contratacoes_modalidade_idx on public.contratacoes (modalidade_id);
create index contratacoes_situacao_idx on public.contratacoes (situacao_id);

create table public.coletas (
  id bigint generated always as identity primary key,
  iniciada_em timestamptz not null default now(),
  terminada_em timestamptz,
  status text not null default 'em_andamento'
    check (status in ('em_andamento', 'sucesso', 'falha')),
  paginas_lidas integer,
  registros_validos integer,
  registros_invalidos integer,
  novas integer,
  atualizadas integer,
  -- Lista de registros rejeitados pela validação: [{"chave": ..., "erro": ...}].
  invalidos jsonb,
  erro text
);

comment on table public.coletas is 'Uma linha por execução do coletor. Alimenta a página de status.';

-- RLS: o público só lê. Não há política de escrita, então anon e authenticated não gravam.
-- O coletor grava como dono das tabelas, que não é barrado pelo RLS.
alter table public.contratacoes enable row level security;
alter table public.coletas enable row level security;

create policy "contratacoes: leitura pública"
  on public.contratacoes for select
  to anon, authenticated
  using (true);

create policy "coletas: leitura pública"
  on public.coletas for select
  to anon, authenticated
  using (true);
