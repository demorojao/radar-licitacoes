# Calendário e cara nova: plano de implementação

> **Para agentes:** use superpowers:executing-plans (ou subagent-driven-development) e siga as
> tarefas na ordem. Os passos usam caixas `- [ ]` para acompanhar.

**Objetivo:** trocar o filtro "até N dias" por um calendário "encerra a partir de" com contagem por
dia, e dar à tela uma cara de produto: marca, exemplos de busca, resumo dos filtros, cartões com
urgência, estado vazio e prévia do link.

**Arquitetura:** a regra de "quais licitações batem" (texto, sinônimos, município, modalidade,
abertas) vira uma função SQL interna, usada por `buscar_contratacoes` (que ganha
`p_encerra_a_partir`) e pela nova `encerramentos_por_dia`. O site lê `a_partir` e `mes` da URL com
Zod, monta a grade do mês numa função pura testada e desenha tudo em Server Components com links.
Só os seletores que se aplicam sozinhos usam um Client Component.

**Tecnologias:** Postgres 17, Next.js 16.4.5 (`next/og` para a imagem), Tailwind 4, Zod 4, Vitest,
pytest.

**Design:** [2026-11-24-calendario-e-visual.md](2026-11-24-calendario-e-visual.md). Leia antes.

## Regras globais

- Branch `visual`. Conventional Commits em português, CI verde em cada commit e documentação no
  mesmo commit.
- Todo "dia" é no horário de Brasília (`America/Sao_Paulo`), no banco e no site.
- URL: `a_partir=AAAA-MM-DD` e `mes=AAAA-MM`. O `prazo` some do site.
- **Compatibilidade:** o site que está no ar chama `buscar_contratacoes` com `p_prazo_dias`. A
  função nova mantém esse parâmetro funcionando, para a migration poder ir para produção antes do
  merge. Ele é removido numa etapa futura.
- Textos exatos:
  - "Encerra a partir de";
  - "Qualquer data";
  - "Experimente:";
  - "Limpar tudo";
  - no resumo, "encerram a partir de 15/12";
  - no estado vazio, "Nenhuma licitação aberta com essa busca.".
- Cores novas só como tokens em `globals.css`: `--ambar` (claro `#b54708`, escuro `#fdb022`), para
  os próximos 7 dias. O vermelho (`--alerta`) continua só para hoje e amanhã.
- Antes de usar uma API do Next, conferir em `web/node_modules/next/dist/docs/`.

## Riscos que os testes precisam cobrir

1. **Virada do dia em Brasília:** uma licitação às 23:30 de 14/12 em Brasília (02:30 de 15/12 em
   UTC) conta no dia 14 e não entra em "a partir de 15/12". Testes nas tarefas 1 e 2.
2. **Data na URL inválida, impossível ou já passada** (`2026-02-30`, `ontem`, `abc`): é ignorada,
   sem erro 500. Teste na tarefa 2.
3. **Mês com primeiro dia no domingo ou no sábado, e meses de 28 a 31 dias:** a grade não pode
   perder nem repetir dias. Teste na tarefa 2.
4. **Contagem do calendário diferente da lista:** a soma das contagens a partir do dia X, no mês,
   bate com as licitações daquele mês na lista. Teste na tarefa 1.
5. **Sem JavaScript:** o formulário continua funcionando pelo botão "Buscar", e o calendário e os
   exemplos são links. Conferência na tarefa 3.

---

### Tarefa 1: banco

**Arquivos:**
- Criar: `supabase/migrations/<timestamp>_calendario_de_encerramento.sql`
- Criar: `coletor/tests/test_calendario.py`
- Criar: `docs/decisoes/0010-calendario-a-partir-de.md`. Alterar `docs/decisoes/README.md` e
  `docs/arquitetura.md`

**Interfaces:**
- Produz:

```sql
-- interna: o que bate com texto (e sinônimos), município e modalidade, entre as abertas
public.contratacoes_que_batem(p_texto text, p_codigo_ibge text, p_modalidade_id integer)
  returns table (numero_controle_pncp text, relevancia real, por_sinonimo boolean)

-- a etiqueta de uma linha (equivalentes escritos no objeto)
public.sinonimos_usados(p_texto text, p_objeto_normalizado text) returns text[]

public.buscar_contratacoes(p_texto, p_codigo_ibge, p_modalidade_id, p_prazo_dias, p_pagina,
                           p_encerra_a_partir date default null)
  -- mesmas colunas de hoje, inclusive sinonimos_usados

public.encerramentos_por_dia(p_texto text, p_codigo_ibge text, p_modalidade_id integer,
                             p_mes date)  -- p_mes = qualquer dia do mês
  returns table (dia date, quantidade bigint)  -- só dias com quantidade > 0, em ordem
```

- [ ] **Passo 1: testes em `coletor/tests/test_calendario.py`** (marcados `integracao`, com
  `nova`/`buscar` de `apoio.py`). Datas fixas no futuro (por exemplo, dezembro do ano que vem), com
  `data_encerramento_proposta` em UTC:
  - `test_a_partir_do_dia_respeita_brasilia` (risco 1): 23:30 de 14/12 em Brasília fica de fora;
    00:30 de 15/12 entra.
  - `test_com_data_a_ordem_e_pelo_prazo_mesmo_com_texto`: "limpeza" no objeto de A (dia 20) e só
    no órgão de B (dia 16); com `p_encerra_a_partir` = 15/12, B vem antes de A.
  - `test_sem_data_a_ordem_continua_a_de_hoje`: o mesmo caso sem data, A antes de B.
  - `test_encerramentos_por_dia_conta_em_brasilia`: duas no dia 15 (uma às 23:30 de Brasília) e
    uma no dia 16 → `[(15/12, 2), (16/12, 1)]`.
  - `test_encerramentos_por_dia_respeita_texto_sinonimo_e_municipio`: "remédio" conta
    "medicamentos" e não conta "cadeiras"; `p_codigo_ibge` filtra.
  - `test_encerramentos_por_dia_ignora_encerradas_e_outros_meses`.
  - `test_contagem_bate_com_a_lista` (risco 4): a soma do mês a partir do dia X é igual ao
    `total` da busca com `p_encerra_a_partir` = X, quando todas as licitações estão nesse mês.
  - `test_prazo_dias_continua_funcionando`: compatibilidade; `p_prazo_dias=7` como hoje.
  - `test_anon_executa_encerramentos_por_dia`.
  - Em `test_busca.py`, os testes que usam `p_prazo_dias` continuam iguais.
- [ ] **Passo 2: vermelho no CI**, num branch descartável (`visual-vermelho`), como nas etapas
  anteriores. Depois apague o branch.
- [ ] **Passo 3: migration.**
  - `contratacoes_que_batem` recebe a lógica de `filtradas` (a regra dos sinônimos termo a termo,
    `tem_exclusao` e `objeto_normalizado`), sem página e sem prazo.
  - `sinonimos_usados` recebe o cálculo da etiqueta.
  - As duas são `stable security invoker set search_path = ''`, com `grant execute` para `anon` e
    `authenticated`.
  - `buscar_contratacoes`: `drop` da assinatura de 5 parâmetros e `create` com 6, filtrando
    `data_encerramento_proposta >= (p_encerra_a_partir::timestamp at time zone 'America/Sao_Paulo')`.
    Com data, ordena por `data_encerramento_proposta, relevancia desc, numero_controle_pncp`.
    Recrie o `comment` e o `grant`.
  - `encerramentos_por_dia` agrupa por
    `(data_encerramento_proposta at time zone 'America/Sao_Paulo')::date` dentro do mês de
    `p_mes`.
- [ ] **Passo 4: verde no CI** do branch `visual`, com a suíte inteira.
- [ ] **Passo 5: documentação.**
  - ADR 0010: o filtro "até N dias" destacava o mais apertado; quem vende precisa saber o que ainda
    dá tempo; opção B escolhida pelo João; alternativas: dia exato e intervalo.
  - Arquitetura: fluxo 2 e funções.
  - Commit: `feat: calendário de encerramento no banco`.
- [ ] **Passo 6: produção.** `db push --dry-run`, depois de verdade. Pelo MCP, confira que
  `encerramentos_por_dia` soma o total de abertas do mês e que `get_advisors` continua vazio.

### Tarefa 2: regras do site (funções puras e dados)

**Arquivos:**
- Alterar: `web/src/lib/parametros.ts`, `parametros.test.ts`
- Criar: `web/src/lib/calendario.ts`, `calendario.test.ts`
- Alterar: `web/src/lib/esquemas.ts`, `esquemas.test.ts`, `web/src/lib/banco.ts`
- Alterar: `web/src/lib/formatacao.ts`, `formatacao.test.ts`

**Interfaces:**
- Consome: `buscar_contratacoes(..., p_encerra_a_partir)` e `encerramentos_por_dia` da tarefa 1.
- Produz:

```ts
// parametros.ts — Filtros perde `prazo` e ganha:
aPartir?: string;   // "AAAA-MM-DD", nunca antes de hoje
mes?: string;       // "AAAA-MM"
lerFiltros(parametros, hoje: string): Filtros      // hoje = "AAAA-MM-DD" em Brasília
linkCom(filtros: Filtros, mudancas: Partial<Filtros>): string  // tira chaves undefined e página
// linkDaPagina continua, preservando aPartir e mes

// calendario.ts
type Dia = { data: string; numero: number; quantidade: number; passado: boolean;
             hoje: boolean; escolhido: boolean };
montarMes(mes: string, contagens: Map<string, number>, hoje: string, escolhido?: string)
  : { titulo: string; semanas: (Dia | null)[][]; anterior: string | null; proximo: string }
// titulo "dezembro de 2026"; semanas de domingo a sábado; null nas casas vazias;
// anterior = null quando o mês é o atual

// formatacao.ts
hojeEmBrasilia(agora: Date): string                         // "AAAA-MM-DD"
urgencia(iso: string, agora: Date): "agora" | "semana" | null // agora = hoje ou amanhã
formatarDiaCurto(data: string): string                       // "2026-12-15" → "15/12"

// banco.ts
encerramentosPorDia(filtros: Filtros, mes: string): Promise<Map<string, number>>
// esquemas.ts
lerEncerramentos(linhas: unknown): Map<string, number>
```

- [ ] **Passo 1: testes.**
  - `parametros.test.ts`:
    - `a_partir` válida é lida;
    - `2026-02-30`, `abc` e uma data antes de `hoje` são ignoradas (risco 2);
    - `mes` `2026-13` é ignorado;
    - `prazo=7` é ignorado;
    - `linkCom` preserva os outros filtros e tira a página.
  - `calendario.test.ts` (risco 3):
    - novembro de 2026 começa no domingo (sem casa vazia antes);
    - agosto de 2026 começa no sábado (6 casas vazias);
    - fevereiro de 2027 tem 28 dias, dezembro de 2026 tem 31;
    - nenhum dia some nem se repete;
    - `passado`, `hoje` e `escolhido` ficam marcados;
    - `anterior` é null no mês atual;
    - `titulo` = "dezembro de 2026".
  - `formatacao.test.ts`:
    - `hojeEmBrasilia` às 02:00 UTC de 15/12 dá "2026-12-14";
    - `urgencia` dá "agora" para hoje e amanhã, "semana" até 7 dias e null depois;
    - `formatarDiaCurto`.
  - `esquemas.test.ts`: `lerEncerramentos` monta o mapa e recusa um formato errado.
- [ ] **Passo 2: vermelho** (`npm test`, no PowerShell em `D:\`).
- [ ] **Passo 3: código.** O `banco.ts` passa `p_encerra_a_partir` e deixa de passar
  `p_prazo_dias`.
- [ ] **Passo 4: verde.** `npm test`, `npm run lint` e `npm run typecheck`. Commit:
  `feat: filtros de data e grade do calendário`.

### Tarefa 3: a tela

**Arquivos:**
- Criar: `web/src/componentes/Cabecalho.tsx`, `Calendario.tsx`, `ResumoDosFiltros.tsx`,
  `Exemplos.tsx`, `SeletorQueEnvia.tsx` (`"use client"`)
- Alterar: `web/src/app/page.tsx`, `FormularioDeBusca.tsx`, `ItemDeLicitacao.tsx`,
  `Paginacao.tsx`, `globals.css`

**Interfaces:**
- Consome: tudo o que a tarefa 2 produz.

- [ ] **Passo 1: estrutura da página.**
  - Cabeçalho com uma marca de radar em SVG inline (círculos concêntricos e um setor, com
    `aria-hidden`), o nome e a contagem viva "N licitações abertas agora". N é a soma das
    quantidades de `opcoes.municipios`, sem consulta extra.
  - Formulário: a busca, "Experimente:" (remédio, carro, pneu, festa, computador) como links
    `/?q=...`, e município e modalidade em `SeletorQueEnvia`. O `onChange` chama
    `form.requestSubmit()`, e o botão "Buscar" continua lá.
  - O calendário ao lado da lista no computador (`lg:` em duas colunas) e acima dela no celular.
  - Resumo dos filtros com um "×" (link `linkCom`) por filtro e "Limpar tudo".
  - O `Calendario`:
    - cada dia é um `Link` para `linkCom(filtros, { aPartir: dia, mes })`;
    - dias passados e dias sem licitação não têm link;
    - a quantidade vem embaixo do número;
    - o fundo fica mais forte conforme a quantidade, em 3 faixas de `bg-verde/10` a `bg-verde/30`;
    - o dia escolhido tem contorno;
    - setas ‹ › são links para o mês anterior e o seguinte;
    - "Qualquer data" tira `aPartir`.
  - As consultas `buscarContratacoes`, `opcoesDeFiltro` e `encerramentosPorDia` rodam juntas, num
    `Promise.all`.
- [ ] **Passo 2: cartões e estado vazio.**
  - Faixa lateral `border-l-4` em `alerta` (agora), `ambar` (semana) ou transparente.
  - Valor alinhado à direita no computador.
  - O estado vazio sugere "tire um filtro" e repete os exemplos.
- [ ] **Passo 3: conferência real** com `next dev` e o Chrome headless:
  - `/`, `/?q=remédio`, `/?a_partir=<dia futuro>` e um mês sem licitações;
  - tema claro e escuro, a 1280 px e a 500 px;
  - sem JavaScript (`--blink-settings=scriptEnabled=false`): os links e o "Buscar" funcionam
    (risco 5).
- [ ] **Passo 4:** `npm test`, `lint`, `typecheck` e `build`. Commit:
  `feat: calendário de encerramento e cara nova da tela`.

### Tarefa 4: prévia do link, documentação e entrega

**Arquivos:**
- Criar: `web/src/app/opengraph-image.tsx` (`ImageResponse` de `next/og`, 1200×630, com a marca,
  o nome e "Licitações abertas em Santa Catarina, com busca que entende a palavra do dia a dia")
- Alterar: `web/src/app/layout.tsx` (`metadataBase` = `https://radar-licitacoes-sc.vercel.app`),
  `README.md` e `docs/arquitetura.md`

- [ ] **Passo 1:** a imagem, conferida abrindo `/opengraph-image` no `next dev`. Commit:
  `feat: imagem de prévia do link`.
- [ ] **Passo 2:** README (status com a data e um número medido do calendário) e arquitetura.
  Commit: `docs: calendário e cara nova no README`.
- [ ] **Passo 3:** revisão final independente e uma passada de correções com vermelho → verde.
- [ ] **Passo 4:** merge **só com o OK do João**. Depois, conferência em produção, guia de estudo
  e apagar o branch.
