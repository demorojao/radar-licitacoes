# Primeira tela: plano de implementação

> **Para agentes:** use superpowers:executing-plans (ou subagent-driven-development) e siga as
> tarefas na ordem. Os passos usam caixas `- [ ]` para acompanhar.

**Objetivo:** publicar em https://radar-licitacoes-sc.vercel.app a lista de licitações abertas de
SC com busca por palavras e filtros.

**Arquitetura:** a busca é uma função SQL no Postgres, criada por migration e testada no CI pelo
pytest. O site (Server Component do Next.js) lê os filtros da URL, valida com Zod e chama a função
com `supabase-js` e a chave pública. O RLS continua valendo.

**Tecnologias:** Postgres 17 (`unaccent`, full-text em português), Next.js 16.4.5, React 19.3,
Tailwind 4, `@supabase/supabase-js` 2.119.2, `zod` 4.6.7 e `vitest` 5.1.1.

**Design:** [2026-11-22-primeira-tela.md](2026-11-22-primeira-tela.md). Leia antes.

## Regras globais

- Branch `tela`. Commits pequenos em Conventional Commits, em português, e CI verde em cada um.
- Antes de usar uma API do Next, conferir em `web/node_modules/next/dist/docs/`. `searchParams`
  é uma `Promise`.
- Situação aberta = `situacao_id = 1`. Credenciamento = `modalidade_id = 12`. 20 itens por página.
- Textos exatos: "O que sua empresa vende?", "Valor não informado",
  "Prazo informado: DD/MM/AAAA (provável erro no PNCP)",
  "Não foi possível carregar as licitações agora", e no filtro de prazo "Até 7 dias",
  "Até 30 dias", "Até 90 dias" e "Qualquer prazo".
- Datas sempre exibidas no fuso `America/Sao_Paulo`, mesmo que o servidor da Vercel use UTC.
- Variáveis do site: `SUPABASE_URL` e `SUPABASE_PUBLISHABLE_KEY`, **sem** `NEXT_PUBLIC_`.
- Documentação no mesmo commit da mudança (regra 5 do `AGENTS.md`).

## Riscos que os testes precisam cobrir

1. **Busca só com palavras vazias** ("de", "   ", "!!!"): `websearch_to_tsquery` gera uma consulta
   sem termos, que não encontra nada. O esperado é tratar como busca vazia e listar tudo.
   Teste na tarefa 1.
2. **URL adulterada** (`pagina=-1`, `pagina=abc`, `prazo=15`, `municipio=x`, `q` repetido): o
   parâmetro inválido é ignorado, sem erro 500. Teste na tarefa 2.
3. **Fuso na Vercel**: um prazo às 23:30 de Brasília não pode aparecer como o dia seguinte. Teste
   na tarefa 2, com `agora` e data em UTC.
4. **Texto gigante na busca**: `q` com 10 mil caracteres é cortado em 200. Teste na tarefa 2.
5. **Resposta inesperada do banco** (formato mudou ou Supabase pausado): a validação com Zod falha
   e a página mostra a mensagem de erro, não uma tela quebrada. Teste na tarefa 3.

---

### Tarefa 1: busca por palavras no banco

**Arquivos:**
- Criar: `supabase/migrations/<timestamp>_criar_busca_por_palavras.sql`, gerado com
  `npx supabase@3.2.0 migration new criar_busca_por_palavras`
- Alterar: `coletor/tests/sql/simular_supabase.sql`, para criar o schema `extensions` e dar
  `usage` a `anon` e `authenticated`, como no Supabase
- Alterar: `coletor/tests/conftest.py`, para que o fixture `conexao` também limpe a coluna nova
  (o `truncate` já resolve; só conferir)
- Criar: `coletor/tests/test_busca.py`
- Criar: `docs/decisoes/0008-busca-numa-funcao-sql.md`. Alterar `docs/decisoes/README.md` e
  `docs/arquitetura.md` (fluxo 2: busca por palavras 🚧, e a tabela do modelo de dados)

**Interfaces:**
- Produz: as funções SQL abaixo, que as tarefas 3 e 5 usam.

```sql
public.buscar_contratacoes(
  p_texto text default null, p_codigo_ibge text default null,
  p_modalidade_id integer default null, p_prazo_dias integer default null,
  p_pagina integer default 1
) returns table (
  numero_controle_pncp text, objeto text, orgao_razao_social text, municipio_nome text,
  modalidade_id integer, modalidade_nome text, valor_total_estimado text,
  data_encerramento_proposta timestamptz, cnpj_orgao text, ano_compra integer,
  sequencial_compra integer, total bigint, pagina integer
)

public.opcoes_de_filtro()
  returns table (tipo text, valor text, nome text, quantidade bigint)
  -- tipo 'municipio' (valor = codigo_ibge) ou 'modalidade' (valor = modalidade_id::text)
```

- [ ] **Passo 1: escrever os testes em `coletor/tests/test_busca.py`.** Marque com
  `pytestmark = pytest.mark.integracao` e reaproveite o padrão `inserir(...)` de
  `test_migrations.py` (mova o helper e o `CONTRATACAO_MINIMA` para um módulo comum, como
  `tests/apoio.py`). Use encerramento futuro (`now() + interval '10 days'`). Os testes:
  - `test_busca_ignora_acento_e_plural`: objeto "Aquisição de produtos de higienização"; buscar
    `"higienizacao"` e `"produto"` devolve a linha.
  - `test_busca_pesa_mais_o_objeto_que_o_orgao`: "limpeza" no objeto de A e só no órgão de B; A
    vem antes de B.
  - `test_so_aparecem_abertas_e_divulgadas`: situações 2, 3 e 4 e uma com encerramento no
    passado não aparecem; só a de situação 1 e prazo futuro aparece.
  - `test_filtros_sozinhos_e_combinados`: `p_codigo_ibge`, `p_modalidade_id` e `p_prazo_dias=7`
    (a de 3 dias entra, a de 10 dias não), sozinhos e juntos.
  - `test_sem_texto_ordena_pelo_prazo_mais_proximo`.
  - `test_paginacao_total_e_pagina_alem_da_ultima`: 25 linhas → página 1 com 20 e `total=25`;
    página 2 com 5; `p_pagina=9` devolve as 5 da página 2 com `pagina=2`; `p_pagina=0` vira 1.
  - `test_texto_sem_termos_lista_tudo`: parametrize com `"de"`, `"   "` e `"!!!"` → mesmo
    resultado que sem texto (risco 1).
  - `test_texto_com_sintaxe_estranha_nao_quebra`: `'"limpeza'`, `"limpeza OR -luva"` e
    `"'; drop table contratacoes; --"` não lançam erro.
  - `test_valor_vem_como_texto_exato`: `valor_total_estimado = "2297628657.83"`.
  - `test_anon_executa_as_funcoes_e_o_rls_vale`: `set local role anon` numa transação; as duas
    funções executam e devolvem as linhas abertas.
  - `test_opcoes_de_filtro_contam_so_abertas`: duas abertas em Joinville e uma revogada →
    `('municipio', '4209102', 'Joinville', 2)`, ordenado por `nome`.

- [ ] **Passo 2: fase vermelha.** Sem banco na máquina, os testes são pulados, e fazer commit de
  teste quebrado vai contra a regra 3. Por isso testes e migration vão no mesmo commit. Para ver
  a falha, rode o passo 4 primeiro com a migration vazia **sem commit** e confira que
  `uv run pytest tests/test_busca.py` mostra os testes pulados (e não com erro de coleta), ou
  seja, que o arquivo de teste importa e é descoberto.

- [ ] **Passo 3: escrever a migration.**
  - `create extension if not exists unaccent with schema extensions;`
  - `create text search configuration public.portugues_sem_acento (copy = pg_catalog.portuguese)`,
    depois `alter mapping for hword, hword_part, word with extensions.unaccent, portuguese_stem`.
  - Coluna `busca tsvector generated always as (setweight(to_tsvector('public.portugues_sem_acento', objeto), 'A') || setweight(to_tsvector('public.portugues_sem_acento', orgao_razao_social), 'B')) stored`
    e `create index contratacoes_busca_idx on public.contratacoes using gin (busca)`.
  - As duas funções, com `language sql stable security invoker set search_path = ''` e nomes
    sempre qualificados (`public.contratacoes`). `grant execute ... to anon, authenticated`.
  - Algoritmo de `buscar_contratacoes`, que a assinatura não determina:
    1. `consulta := websearch_to_tsquery('public.portugues_sem_acento', coalesce(p_texto, ''))`.
       Se `numnode(consulta) = 0`, a busca é sem texto.
    2. Linhas filtradas: `situacao_id = 1`, `data_encerramento_proposta > now()` e cada filtro
       não nulo. Prazo: `data_encerramento_proposta <= now() + make_interval(days => p_prazo_dias)`.
    3. `total = count(*)` das filtradas.
       `pagina = least(greatest(p_pagina, 1), greatest(ceil(total / 20.0)::int, 1))`.
    4. Ordem: com texto, `ts_rank(busca, consulta) desc` e depois prazo; sem texto, só prazo.
       Desempate por `numero_controle_pncp`.
    5. `limit 20 offset (pagina - 1) * 20`; `valor_total_estimado::text`.

- [ ] **Passo 4: verificar localmente.** Em `coletor/`, rodar `uv run ruff check .`,
  `uv run ruff format --check .`, `uv run mypy` e `uv run pytest`: tudo passa, e os testes de
  banco aparecem pulados.

- [ ] **Passo 5: commit e push, com a documentação junto.**

```bash
git add supabase/migrations coletor/tests docs/decisoes docs/arquitetura.md
git commit -m "feat: busca por palavras em português numa função SQL"
git push -u origin tela
```

- [ ] **Passo 6: CI verde.** Na aba Actions, o job "Coletor" do branch `tela` fica verde, com os
  testes de `test_busca.py` **passando**, e não pulados. Se ficar vermelho, corrija num commit
  `fix:` antes da tarefa 2.

---

### Tarefa 2: regras de exibição e filtros da URL no site

**Arquivos:**
- Instalar: `npm install zod@4.6.7` e `npm install -D vitest@5.1.1`, em `web/` e em segundo plano
  (o HD é lento)
- Criar: `web/vitest.config.ts`, com o alias `@` → `src`
- Alterar: `web/package.json` (script `"test": "vitest run"`) e `.github/workflows/ci.yml` (passo
  "Testes" com `npm test` no job web, antes do build)
- Criar: `web/src/lib/parametros.ts` e `web/src/lib/parametros.test.ts`
- Criar: `web/src/lib/formatacao.ts` e `web/src/lib/formatacao.test.ts`
- Alterar: a tabela "Verificações" do `AGENTS.md` (linha `npm test`)

**Interfaces:**
- Produz, em `parametros.ts`:
  - `type Prazo = 7 | 30 | 90`
  - `type Filtros = { q?: string; municipio?: string; modalidade?: number; prazo?: Prazo; pagina: number }`
  - `lerFiltros(sp: Record<string, string | string[] | undefined>): Filtros`
  - `linkDaPagina(filtros: Filtros, pagina: number): string`: `"/?q=...&pagina=2"`, sem parâmetros
    vazios e sem `pagina=1`
- Produz, em `formatacao.ts`:
  - `formatarValor(valor: string | null): string`
  - `formatarDataHora(iso: string): string`
  - `prazoRelativo(iso: string, agora: Date): string`
  - `prazoSuspeito(iso: string, agora: Date): boolean`
  - `linkPncp(c: { cnpj_orgao: string; ano_compra: number; sequencial_compra: number }): string`

- [ ] **Passo 1: escrever os testes.**
  - `lerFiltros`:
    - `{}` → `{ pagina: 1 }`;
    - `{ q: "  limpeza  " }` → `q: "limpeza"`;
    - `q` com 10.000 caracteres → 200 caracteres (risco 4);
    - `q: ["a", "b"]` → `"a"`;
    - `municipio: "4209102"` é aceito e `"x"` ou `"123"` são ignorados (o código IBGE tem 7
      dígitos);
    - `modalidade: "12"` → `12`, e `"abc"` é ignorado;
    - `prazo: "30"` → `30`, e `"15"` é ignorado;
    - `pagina: "-1"`, `"abc"` e `"0"` → `1` (risco 2);
    - `pagina: "3"` → `3`.
  - `linkDaPagina({ q: "material de limpeza", pagina: 1 }, 2)` → `"/?q=material+de+limpeza&pagina=2"`,
    e `linkDaPagina({ pagina: 3 }, 1)` → `"/"`.
  - `formatarValor`: `"258930.70"` → `"R$ 258.930,70"`, `"2297628657.83"` →
    `"R$ 2.297.628.657,83"`, `"0.00"` e `null` → `"Valor não informado"`. Compare com o espaço
    que o `Intl` usa (` `).
  - `formatarDataHora("2026-11-26T02:30:00Z")` → `"25/11/2026 23:30"` (risco 3).
  - `prazoRelativo`, com `agora = 2026-11-22T15:00:00Z`:
    - `2026-11-22T23:00:00-03:00` → `"encerra hoje"`;
    - `2026-11-23T09:00:00-03:00` → `"encerra amanhã"`;
    - `2026-11-25T09:00:00-03:00` → `"encerra em 3 dias"`;
    - `2027-02-20T09:00:00-03:00` → `"encerra em 3 meses"`.
    A conta é por dia do calendário em Brasília: de 2 a 59 dias, "em N dias"; a partir de 60,
    "em N meses", com N = `floor(dias / 30)`.
  - `prazoSuspeito`: daqui a 5 anos e 1 dia → `true`; daqui a 2 anos → `false`.
  - `linkPncp({ cnpj_orgao: "11433441000101", ano_compra: 2023, sequencial_compra: 1 })` →
    `"https://pncp.gov.br/app/editais/11433441000101/2023/1"`.

- [ ] **Passo 2: confirmar que falham.** `npm test` em `web/` falha com "Failed to resolve import".

- [ ] **Passo 3: implementar.** `lerFiltros` usa um esquema Zod por campo com `.catch(undefined)`,
  para um campo inválido não derrubar os outros. As datas usam
  `Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo" })` e a moeda usa
  `Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })`, que aceita a string
  decimal sem passar por float.

- [ ] **Passo 4: verificar.** Em `web/`, rodar `npm test`, `npm run lint` e `npm run typecheck`:
  tudo passa.

- [ ] **Passo 5: commit.**

```bash
git add web/package.json web/package-lock.json web/vitest.config.ts web/src/lib .github/workflows/ci.yml AGENTS.md
git commit -m "feat: filtros da URL e formatação de valores e prazos no site"
```

---

### Tarefa 3: leitura do banco pelo site

**Arquivos:**
- Instalar: `npm install @supabase/supabase-js@2.119.2`
- Criar: `web/src/lib/esquemas.ts` e `web/src/lib/esquemas.test.ts`
- Criar: `web/src/lib/banco.ts`, com `import "server-only"` (opcional no Next 16, segundo a
  documentação instalada)
- Criar: `web/.env.example`. Conferir se o `web/.gitignore` ignora `.env.local`
- Alterar: `README.md`, na seção "Site" (copiar `.env.example` para `.env.local`)

**Interfaces:**
- Consome: `Filtros` (tarefa 2) e as funções SQL (tarefa 1).
- Produz, em `esquemas.ts`:
  - `type Contratacao`: as colunas de `buscar_contratacoes`, sem `total` e `pagina`
  - `type ResultadoBusca = { contratacoes: Contratacao[]; total: number; pagina: number; totalDePaginas: number }`
  - `lerResultadoBusca(linhas: unknown): ResultadoBusca`: lança erro se o formato não bater; sem
    linhas, `{ contratacoes: [], total: 0, pagina: 1, totalDePaginas: 0 }`
  - `type OpcoesDeFiltro = { municipios: Opcao[]; modalidades: Opcao[] }`, com
    `Opcao = { valor: string; nome: string; quantidade: number }`
  - `lerOpcoes(linhas: unknown): OpcoesDeFiltro`
- Produz, em `banco.ts` (só no servidor):
  - `buscarContratacoes(filtros: Filtros): Promise<ResultadoBusca>`, que chama
    `rpc("buscar_contratacoes", { p_texto, p_codigo_ibge, p_modalidade_id, p_prazo_dias, p_pagina })`
  - `opcoesDeFiltro(): Promise<OpcoesDeFiltro>`
  - `ultimaColeta(): Promise<string | null>`: o `terminada_em` da última coleta com
    `status = 'sucesso'`, por `select` em `coletas`
  - Qualquer erro do Supabase vira `throw`, e quem trata é o `error.tsx` da tarefa 4

- [ ] **Passo 1: escrever os testes de `esquemas.ts`.**
  - Uma linha real (copiada do formato da função) vira `Contratacao` e `total: 25`, `pagina: 2`,
    `totalDePaginas: 2`.
  - `[]` → resultado vazio.
  - Linha sem `objeto`, ou `total` como texto → lança erro (risco 5).
  - `lerOpcoes` separa municípios e modalidades e mantém a ordem recebida.

- [ ] **Passo 2: confirmar que falham** com `npm test`.

- [ ] **Passo 3: implementar `esquemas.ts` e `banco.ts`.** As variáveis de ambiente são lidas
  dentro das funções, e não no topo do módulo, para o `next build` do CI passar sem elas. Sem as
  variáveis, a função lança `Error("SUPABASE_URL e SUPABASE_PUBLISHABLE_KEY precisam estar definidas")`.

- [ ] **Passo 4: verificar.** Rodar `npm test`, `npm run lint`, `npm run typecheck` e
  `npm run build` (o build em segundo plano): tudo passa.

- [ ] **Passo 5: commit.**

```bash
git add web README.md
git commit -m "feat: leitura das licitações pelo site com a chave pública do Supabase"
```

---

### Tarefa 4: a página

Use a skill `frontend-design:frontend-design` para o visual. O rascunho e as regras estão no
design.

**Arquivos:**
- Alterar: `web/src/app/layout.tsx`: `lang="pt-BR"` e `metadata` com título
  "Radar de Licitações SC" e descrição "Licitações abertas em Santa Catarina, atualizadas todo
  dia."
- Reescrever: `web/src/app/page.tsx` (Server Component) e `web/src/app/globals.css`
- Criar: `web/src/app/error.tsx` (Client Component, com "Não foi possível carregar as licitações
  agora" e um botão "Tentar de novo")
- Criar: os componentes em `web/src/componentes/`: formulário de busca e filtros (`next/form`),
  cartão da licitação, paginação e rodapé
- Apagar: os SVGs de exemplo em `web/public/` que deixarem de ser usados

**Interfaces:**
- Consome: `lerFiltros` e `linkDaPagina` (tarefa 2), as funções de `formatacao.ts` (tarefa 2) e
  `buscarContratacoes`, `opcoesDeFiltro` e `ultimaColeta` (tarefa 3).

- [ ] **Passo 1: implementar a página** como no rascunho do design:
  - `await searchParams`, depois `lerFiltros`, e as três leituras do banco com `Promise.all`;
  - contador "N licitações abertas encontradas";
  - cartões com prazo relativo e data, modalidade, objeto (3 linhas no máximo), órgão,
    município, valor e "Ver no PNCP ↗";
  - aviso de credenciamento quando `modalidade_id = 12`;
  - aviso de prazo suspeito;
  - lista vazia com sugestão de tirar filtros;
  - paginação "‹ Anterior · Página X de Y · Próxima ›";
  - rodapé com a última coleta e o link do GitHub;
  - os seletores mantêm o valor atual.

- [ ] **Passo 2: verificar com dados reais.** Criar `web/.env.local` com as duas variáveis (a URL
  e a chave pública do projeto) e rodar `npm run dev` em segundo plano. Abrir
  `http://localhost:3000` e conferir:
  - `?q=higienizacao` acha textos com "higienização";
  - um filtro de município muda o contador;
  - `?pagina=999` mostra a última página;
  - `?q=de` mostra a lista completa;
  - o link "Ver no PNCP" de um cartão abre a licitação certa no site oficial (confirma o formato
    da URL);
  - a página funciona com 375 px de largura e em tema escuro.

- [ ] **Passo 3: verificar.** Rodar `npm test`, `npm run lint`, `npm run typecheck` e
  `npm run build`: tudo passa.

- [ ] **Passo 4: commit.**

```bash
git add web
git commit -m "feat: primeira tela com busca, filtros e lista de licitações"
```

---

### Tarefa 5: produção

- [ ] **Passo 1: aplicar a migration no Supabase.** Só depois da troca da senha que vazou. Rodar
  `npx supabase@3.2.0 db push --remote="$DATABASE_URL" --dry-run`, que deve listar só
  `criar_busca_por_palavras`. Depois rodar sem `--dry-run`. Pelo MCP, conferir que
  `buscar_contratacoes(p_texto => 'limpeza')` responde e que `get_advisors` (security) volta
  vazio.
- [ ] **Passo 2: prévia da Vercel.** Com o push do branch `tela`, a Vercel cria uma prévia. O
  João confere a tela com dados reais. As variáveis já precisam estar em *Preview* e *Production*.
- [ ] **Passo 3: levar para a `main`.** Com o CI verde no branch, rodar
  `git switch main && git merge --ff-only tela && git push`. Conferir que o site de produção
  mostra a tela nova.
- [ ] **Passo 4: documentação de produção.** README com o link
  https://radar-licitacoes-sc.vercel.app e a tabela de status (busca por palavras ✅, busca por
  significado e análise com IA 📋). No `docs/arquitetura.md`, o site passa a 🚧, com a lista
  e a busca ✅. No plano de design, status ✅ implementado.

```bash
git add README.md docs
git commit -m "docs: site no ar com busca por palavras e filtros"
git push
```

- [ ] **Passo 5: guia de estudo.** Atualizar o artefato com a tela, o ADR 0008, novos cartões
  (função SQL e RLS, full-text e `unaccent`, por que Zod na URL) e o progresso. Apagar o branch
  `tela`.
