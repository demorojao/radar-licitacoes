# Busca com sinônimos: plano de implementação

> **Para agentes:** use superpowers:executing-plans (ou subagent-driven-development) e siga as
> tarefas na ordem. Os passos usam caixas `- [ ]` para acompanhar.

**Objetivo:** buscar "remédio" encontra as licitações de medicamento, e cada licitação que entrou
só por um sinônimo mostra a etiqueta "Encontrada pelo sinônimo medicamento".

**Arquitetura:** uma tabela `public.sinonimos`, preenchida por migration, guarda "termo digitado →
equivalentes". A função `buscar_contratacoes` reescreve a consulta com `ts_rewrite` (termo vira
"termo OU equivalentes") e devolve uma coluna nova, `sinonimos_usados`. O site valida a coluna com
Zod e mostra a etiqueta. Nenhuma dependência nova, nenhuma chave nova.

**Tecnologias:** Postgres 17 (full-text, `ts_rewrite`), Next.js 16.4.5, Zod 4.6.7, Vitest 5.1.1,
pytest.

**Design:** [2026-11-24-busca-com-sinonimos.md](2026-11-24-busca-com-sinonimos.md). Leia antes.

## Regras globais

- Branch `sinonimos`. Commits pequenos em Conventional Commits, em português, e CI verde em cada
  um. Documentação no mesmo commit da mudança.
- Textos exatos da etiqueta: "Encontrada pelo sinônimo medicamento" (um) e
  "Encontrada pelos sinônimos veículo e automóvel" (dois ou mais, juntados com
  `Intl.ListFormat("pt-BR", { type: "conjunction" })`).
- A relação tem direção: `termo` é o que a pessoa digita e `equivalentes` são as palavras do
  edital. Primeira versão: só palavras soltas dos dois lados.
- Uma palavra não pode ser termo numa linha e equivalente em outra, para a reescrita não encadear.
- A lista sai de medição nos dados reais. Um par só entra se acrescenta resultados e se uma amostra
  de 5 títulos não traz nada errado (anti-objetivo do design: o "medic" de médico).
- A migration é só aditiva para o site atual: o Zod de hoje descarta a coluna nova. Por isso ela
  pode ir para produção antes do merge, como na etapa anterior.

## Riscos que os testes precisam cobrir

1. **Sinônimo dentro de exclusão** ("pneu -carro"): as licitações de veículo também ficam de fora,
   e nenhuma etiqueta aparece. Teste na tarefa 2.
2. **Contagem e paginação** com sinônimo: `total` conta as licitações encontradas pelo sinônimo, e
   os filtros de município e prazo continuam valendo. Teste na tarefa 2.
3. **Linha inválida na tabela** (palavra vazia, com espaço, ou que some na busca, como "de"): a
   tabela recusa na hora de gravar, e não quebra a busca depois. Teste na tarefa 2.
4. **Reescrita encadeada**: uma palavra que é termo e também equivalente de outro termo. Um teste
   sobre a lista real garante que isso não existe. Tarefa 2.
5. **Dois termos com sinônimo na mesma busca** ("remédio carro"): a licitação que tem
   "medicamento" e "veículo" mostra as duas palavras na etiqueta. Teste na tarefa 2.

---

### Tarefa 1: medir e escolher a lista inicial

**Arquivos:**
- Criar: `docs/sinonimos.md`

**Interfaces:**
- Produz: a lista de pares `termo → equivalentes[]` que a tarefa 2 grava na migration. Ela
  precisa ter `remédio → medicamento` e `carro → veículo, automóvel`, que os testes usam.

- [ ] **Passo 1: medir as palavras oficiais mais comuns.** Pelo MCP (somente leitura), rode
  `ts_stat` sobre a coluna `busca` das licitações abertas (`situacao_id = 1` e encerramento
  futuro), com as 150 palavras de maior `ndoc`. Salve o resultado no scratchpad, não no
  repositório.
- [ ] **Passo 2: propor pares.** Para cada palavra oficial frequente que tem um jeito comum de
  dizer (veículo ← carro, medicamento ← remédio), proponha o termo do dia a dia. Use como ponto
  de partida os grupos medidos no design (limpeza/higienização, informática/computador). Meta:
  de 30 a 50 termos.
- [ ] **Passo 3: conferir cada par no banco.** Para cada par, meça: quantas licitações o termo
  acha sozinho, quantas acha com os equivalentes, quantas entram **só** pelos equivalentes e 5
  títulos dessas. Descarte o par que não acrescenta nada ou que traz um título errado.
- [ ] **Passo 4: escrever `docs/sinonimos.md`.** Diga para que serve a lista, as regras (direção,
  palavras soltas, sem encadear, critério de aceite) e como acrescentar um par (migration nova).
  Inclua uma tabela `termo | equivalentes | sozinho | com sinônimos | só por sinônimo` com a data
  da medição, e uma seção "Descartados" com o motivo de cada um.
- [ ] **Passo 5: commit.** `docs: lista inicial de sinônimos medida nos dados reais`

### Tarefa 2: sinônimos no banco

**Arquivos:**
- Criar: `supabase/migrations/<timestamp>_busca_com_sinonimos.sql`, gerado com
  `npx supabase@3.2.0 migration new busca_com_sinonimos`
- Criar: `coletor/tests/test_sinonimos.py`
- Criar: `docs/decisoes/0009-sinonimos-em-vez-de-embeddings.md`. Alterar `docs/decisoes/README.md`
  e `docs/arquitetura.md` (fluxo 2 e o modelo de dados)

**Interfaces:**
- Consome: a lista da tarefa 1 e as funções `public.normalizar_para_busca(text)` e
  `public.buscar_contratacoes(...)` (migration `20261122181451`).
- Produz: `public.buscar_contratacoes` com os mesmos parâmetros e as mesmas colunas de antes, mais
  `sinonimos_usados text[]` no fim, depois de `pagina`. A tarefa 3 lê essa coluna.

```sql
create table public.sinonimos (
  termo text primary key,        -- como se escreve: 'remédio'
  equivalentes text[] not null   -- '{medicamento,fármaco}'
);
-- Monta as consultas só a partir de linhas que já passaram pelas restrições da tabela.
create view public.sinonimos_consulta with (security_invoker = true) as
  select termo, equivalentes,
         ... as alvo,        -- tsquery do termo normalizado
         ... as substituto   -- tsquery: termo | equivalente | ...
  from public.sinonimos;
```

- [ ] **Passo 1: escrever `coletor/tests/test_sinonimos.py`.** Marque com
  `pytestmark = pytest.mark.integracao` e reaproveite `nova`, `buscar` e `chaves` de
  `test_busca.py`, movendo os três para `tests/apoio.py`. Os testes usam a lista real gravada pela
  migration. O fixture `conexao` limpa só `contratacoes` e `coletas`. Os testes:
  - `test_remedio_acha_medicamento_com_etiqueta`: objeto "Aquisição de medicamentos";
    `buscar(p_texto="remédio")` devolve a linha com `sinonimos_usados == ["medicamento"]`.
  - `test_quem_tem_a_palavra_digitada_vem_sem_etiqueta`: objetos "Locação de carro" e
    "Aquisição de veículo"; buscar "carro" devolve as duas; a de carro com `[]` e a de veículo com
    `["veículo"]`.
  - `test_plural_e_acento_no_termo_digitado`: parametrize `"remédios"`, `"remedio"` e
    `"REMÉDIO"`; todos acham "Aquisição de medicamentos".
  - `test_exclusao_vale_para_os_sinonimos` (risco 1): objetos "Pneus para veículo" e
    "Pneus para máquinas"; "pneu -carro" devolve só a de máquinas, com `[]`.
  - `test_frase_exata_com_sinonimo`: objeto "Aluguel de veículo"; `'"aluguel de carro"'` acha a
    linha.
  - `test_palavra_sem_sinonimo_funciona_como_antes`: "cadeira" acha "Aquisição de cadeiras" com
    `[]`.
  - `test_total_e_filtros_contam_os_sinonimos` (risco 2): 25 linhas de "veículo" em Joinville e
    uma em Taió; "carro" com `p_codigo_ibge=JOINVILLE` dá `total == 25` e 20 linhas na página 1.
  - `test_dois_termos_com_sinonimo` (risco 5): objeto "Medicamentos e veículo"; "remédio carro"
    devolve `sinonimos_usados == ["veículo", "medicamento"]` (ordem de `termo`: carro antes de
    remédio).
  - `test_ou_com_sinonimo`: objetos "Aquisição de medicamentos" e "Aquisição de cadeiras";
    "remédio or cadeira" devolve as duas.
  - `test_sem_texto_a_etiqueta_vem_vazia`: sem `p_texto`, toda linha vem com `[]`.
  - `test_tabela_recusa_linha_invalida` (risco 3): parametrize `("de", ["remedio"])`,
    `("duas palavras", ["x"])`, `("", ["x"])` e `("pneu", [])`; o insert lança
    `psycopg.errors.CheckViolation`.
  - `test_nenhuma_palavra_e_termo_e_equivalente` (risco 4): em `public.sinonimos_consulta`,
    nenhuma linha `s` tem `s.substituto @> t.alvo` para outro termo `t`.
  - `test_lista_tem_os_pares_do_design`: `remédio` tem `medicamento` e `carro` tem `veículo` e
    `automóvel`.
  - `test_anon_le_sinonimos_e_nao_grava`: com `set local role anon`, a busca "remédio" funciona,
    o `select` em `public.sinonimos` e em `public.sinonimos_consulta` funciona e o `insert` falha com
    `psycopg.errors.InsufficientPrivilege` ou é barrado pelo RLS.
- [ ] **Passo 2: fase vermelha.** Sem Postgres na máquina, como na etapa anterior: envie só os
  testes para um branch descartável `sinonimos-vermelho`, confira no CI que eles **falham** (a
  tabela e a coluna ainda não existem) e apague o branch. Os testes de `test_busca.py` continuam
  verdes nesse run.
- [ ] **Passo 3: escrever a migration.**
  - A tabela e a view acima. Na view, `alvo` = `websearch_to_tsquery('public.portugues_sem_acento',
    public.normalizar_para_busca(termo))` e `substituto` = `to_tsquery(` com o mesmo dicionário e
    `public.normalizar_para_busca(termo || ' | ' || array_to_string(equivalentes, ' | ')))`. O
    `to_tsquery` é seguro aqui porque as restrições garantem que só há letras.
  - Restrições da tabela, todas `check`, para uma linha inválida dar `CheckViolation` no insert:
    `termo ~ '^[[:alpha:]]+$'`, `cardinality(equivalentes) > 0`, cada equivalente só letras
    (`array_to_string(equivalentes, ' ') ~ '^[[:alpha:]]+( [[:alpha:]]+)*$'`) e
    `numnode(websearch_to_tsquery('public.portugues_sem_acento', public.normalizar_para_busca(termo))) = 1`,
    que recusa palavras que a busca ignora, como "de".
  - RLS ligado na tabela e a política `"sinonimos: leitura pública"` para `anon, authenticated`, no
    padrão da migration `20261122133408`. A view é `security_invoker`, então o RLS da tabela vale
    também por ela. `grant select` na view para `anon, authenticated`.
  - O `insert` da lista da tarefa 1.
  - `drop function public.buscar_contratacoes(text, text, integer, integer, integer)`, porque o
    tipo de retorno muda e o `create or replace` não aceita isso. Depois, a função nova e de novo
    `grant execute ... to anon, authenticated`.
  - Mudanças na função, que a assinatura não determina:
    1. A CTE `consulta` passa a ter `original` (a de hoje, com `numnode = 0` virando null) e
       `q = ts_rewrite(original, 'select alvo, substituto from public.sinonimos_consulta')`, quando
       `original` não é null.
    2. `filtradas`, `relevancia` (`ts_rank(c.busca, q)`) e a ordem continuam iguais, trocando a
       consulta por `q`. Os resultados por sinônimo se misturam aos outros pela relevância.
    3. `sinonimos_usados` é calculado só no `select` final, para as 20 linhas da página: `'{}'`
       quando `original` é null ou quando `c.busca @@ original`. Senão, os equivalentes `e` (como
       estão escritos na tabela) das linhas `s` com `original @> s.alvo` e
       `c.busca @@ to_tsquery('public.portugues_sem_acento', public.normalizar_para_busca(e))`,
       em ordem de `s.termo` e da posição de `e` no array.
- [ ] **Passo 4: verde.** `git push` do branch `sinonimos` e confira no CI: lint, mypy e todos os
  testes de banco passam, os antigos e os novos.
- [ ] **Passo 5: documentação.** ADR 0009, com contexto (a medição do design), decisão,
  alternativas (embeddings, `ts_rewrite` contra dicionário de sinônimos em arquivo, que o Supabase
  não permite) e consequências. `docs/arquitetura.md`: o fluxo 2 troca o passo do embedding por
  "✅ sinônimos", e o modelo de dados ganha a tabela `sinonimos`. A busca por significado fica
  como possibilidade futura, ligada ao ADR.
- [ ] **Passo 6: commit.** Testes, migration e documentação juntos:
  `feat: busca com sinônimos no banco`

### Tarefa 3: etiqueta no site

**Arquivos:**
- Alterar: `web/src/lib/esquemas.ts`, `web/src/lib/esquemas.test.ts`
- Alterar: `web/src/lib/formatacao.ts`, `web/src/lib/formatacao.test.ts`
- Alterar: `web/src/componentes/ItemDeLicitacao.tsx`

**Interfaces:**
- Consome: a coluna `sinonimos_usados text[]` da tarefa 2.
- Produz: `Contratacao.sinonimos_usados: string[]` e
  `etiquetaDeSinonimos(sinonimos: string[]): string | null` em `formatacao.ts`.

- [ ] **Passo 1: testes.**
  - Em `formatacao.test.ts`, `describe("etiquetaDeSinonimos")`:
    - `[]` → `null`;
    - `["medicamento"]` → `"Encontrada pelo sinônimo medicamento"`;
    - `["veículo", "automóvel"]` → `"Encontrada pelos sinônimos veículo e automóvel"`;
    - `["a", "b", "c"]` → `"Encontrada pelos sinônimos a, b e c"`.
  - Em `esquemas.test.ts`: acrescente `sinonimos_usados: []` à linha de exemplo; um teste novo
    "mantém os sinônimos usados de cada licitação" (`["medicamento"]` chega em
    `contratacoes[0].sinonimos_usados`); e "recusa sinônimos fora de uma lista de textos"
    (`sinonimos_usados: "medicamento"` lança erro).
- [ ] **Passo 2: vermelho.** No PowerShell, em `D:\` maiúsculo:
  `Set-Location 'D:\projectts\projeto_empregadoT1\radar-licitacoes\web'; npm test`.
  Esperado: falham os testes novos, porque a função não existe e o esquema descarta o campo.
- [ ] **Passo 3: código.** `sinonimos_usados: z.array(z.string())` no esquema `contratacao`;
  `etiquetaDeSinonimos` com `Intl.ListFormat`. Em `ItemDeLicitacao`, quando a etiqueta não é
  null, mostre-a numa linha própria logo abaixo do objeto (`<h2>`), em `text-sm`, com a cor
  `text-verde`. Assim ela fica perto do texto que não tem a palavra buscada.
- [ ] **Passo 4: verde.** `npm test`, `npm run lint`, `npm run typecheck` e `npm run build`
  passam.
- [ ] **Passo 5: conferência real.** Com a migration já em produção (tarefa 4, passo 1), rode
  `next dev` e abra no Chrome `/?q=remédio` e `/?q=carro`: as licitações por sinônimo mostram a
  etiqueta, e as que têm a palavra não mostram. Confira o tema claro e o escuro, e a largura de
  500 px.
- [ ] **Passo 6: commit.** `feat: etiqueta dos resultados encontrados por sinônimo`

### Tarefa 4: produção

**Arquivos:**
- Alterar: `README.md` (status: a linha "busca por significado 📋" vira "busca com sinônimos ✅",
  com o exemplo medido "remédio" → N licitações e a data)

- [ ] **Passo 1: aplicar a migration.** Use o padrão do `.env`, sem ler o arquivo:
  `set -a && . coletor/.env && set +a && npx --yes supabase@3.2.0 db push --remote="$DATABASE_URL" --dry-run`,
  mascarando a URL com `sed`. Se aparecer só a migration nova, rode sem `--dry-run`. Pelo MCP,
  confira: "remédio" e "carro" acham o que `docs/sinonimos.md` prevê, e `get_advisors` não
  acusa nada novo. Isso pode ser feito antes da tarefa 3, porque a mudança é aditiva.
- [ ] **Passo 2: README.** Atualize a linha de status com os números medidos em produção.
  Commit: `docs: busca com sinônimos no README`.
- [ ] **Passo 3: revisão final** do branch inteiro por um revisor independente, e uma passada de
  correções com teste vermelho → verde para cada ponto crítico ou importante.
- [ ] **Passo 4: merge, só com o OK do João.** `git switch main && git merge --ff-only sinonimos
  && git push`. Depois, confira https://radar-licitacoes-sc.vercel.app/?q=remédio no Chrome
  headless, apague o branch e atualize o guia de estudo.
