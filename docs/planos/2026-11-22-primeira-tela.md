# Plano: primeira tela (lista, filtros e busca por palavras) e deploy na Vercel

> Status: ✅ aprovado pelo João em 22/11/2026 · implementação 📋

## Por que

O Radar precisa de um link que um recrutador abre e usa em segundos, com dados reais. Hoje a coleta
roda todo dia e o banco tem 2.805 licitações abertas de SC (22/11/2026), mas o site ainda é a
página padrão do Next.js. Esta etapa entrega a primeira tela pública.

## Objetivos

- Uma página em `/` com a caixa **"O que sua empresa vende?"**, filtros e a lista de licitações
  abertas, publicada na Vercel.
- Busca por **palavras** em português que ignora acentos e plurais: "higienizacao" encontra
  "higienização", e "luva" encontra "luvas".
- Filtros por município, modalidade e prazo de encerramento.
- Cada filtro fica na URL (`/?q=limpeza&municipio=4205407`), então dá para mandar uma busca por
  link.
- Mostrar a data da última coleta, para quem visita saber que os dados são atuais.

## Fora do escopo (próximas etapas)

- Busca por significado (embeddings) e análise do edital com IA.
- Página de detalhe da licitação, itens e arquivos.
- Login, favoritos e alertas.
- Teste de ponta a ponta no navegador (Playwright).
- Cache das páginas: os dados mudam uma vez por dia e o volume é pequeno. Medimos antes de otimizar.

## O que não pode acontecer

- Mostrar como aberta uma licitação revogada, anulada, suspensa ou com prazo vencido.
- Mostrar "R$ 0,00" quando o órgão não informou o valor.
- Apresentar uma data no ano 2125 como prazo real.
- Colocar a senha do banco, ou qualquer segredo, na Vercel ou no navegador.
- O README prometer busca com IA antes de ela existir.
- Página quebrada se o Supabase estiver fora do ar: aparece uma mensagem clara.

## Restrições

- Orçamento zero: Vercel Hobby e Supabase Free.
- Next.js 16.4.5 (App Router), React 19.3 e Tailwind 4, já instalados. Antes de usar uma API do
  Next, conferir em `web/node_modules/next/dist/docs/`. `searchParams` é uma *Promise*.
- O banco já tem RLS de leitura pública em `contratacoes` e `coletas`.
- Dependências novas conferidas em 22/11/2026: `@supabase/supabase-js` 2.119.2 (MIT) e `zod`
  4.6.7, mais `vitest` para testes do site.

## Abordagens consideradas

| | Como funciona | Prós | Contras |
|---|---|---|---|
| **A. Função SQL chamada pelo site (escolhida)** | A busca vira uma função no Postgres, criada por migration. O servidor do site a chama com `supabase-js` e a chave pública. | A lógica é testada no CI com os testes de banco que já existem. A busca com IA muda só a função, e a tela fica igual. Nenhum segredo na Vercel. | Mais SQL para entender. |
| B. Consulta montada no TypeScript | `.from('contratacoes').textSearch().eq()` no site. | Menos SQL agora. | A busca híbrida vai exigir uma função SQL de qualquer jeito, e testar no TypeScript exigiria simular o banco. |
| C. Site conecta direto no Postgres | Igual ao coletor, com `pg` ou `postgres`. | SQL puro. | Senha do banco na Vercel, um usuário novo só de leitura e muitas conexões abertas por funções serverless. |

O João escolheu **A** em 22/11/2026. Vira o ADR 0008.

## Como vai funcionar

### Banco (migration nova)

1. Extensão `unaccent` no schema `extensions`, como o Supabase recomenda.
2. Configuração de busca `public.portugues_sem_acento`: cópia da `portuguese` que tira os acentos
   antes de reduzir as palavras ao radical.
3. Coluna gerada `busca tsvector` em `contratacoes`, calculada pelo próprio Postgres a partir do
   **objeto** (peso maior) e do **nome do órgão** (peso menor). Índice GIN nessa coluna. O coletor
   não muda: coluna gerada não entra no `INSERT`.
4. Função `buscar_contratacoes(texto, codigo_ibge, modalidade_id, prazo_dias, pagina)`:
   - devolve só situação 1 ("Divulgada no PNCP") com `data_encerramento_proposta > now()`;
   - com texto, usa `websearch_to_tsquery`, que aceita o que a pessoa digitar sem erro de sintaxe,
     e ordena pela relevância e depois pelo prazo;
   - sem texto, ordena pelo prazo, o mais próximo primeiro;
   - 20 por página e o total encontrado na mesma consulta (`count(*) over ()`);
   - `stable`, `security invoker` (o RLS continua valendo para quem chama) e
     `set search_path = ''`.
5. Função `opcoes_de_filtro()`: municípios e modalidades que têm licitação aberta agora, com a
   contagem, para montar os seletores.
6. Permissão de `execute` nas duas funções para `anon` e `authenticated`.

Nos testes, o `simular_supabase.sql` passa a criar o schema `extensions`, como no Supabase.

### Site

Rascunho da tela (celular primeiro; no computador, os filtros ficam numa coluna ao lado):

```
Radar de Licitações SC                                  [GitHub]
Licitações abertas em Santa Catarina, atualizadas todo dia.

┌──────────────────────────────────────────────┬─────────┐
│ O que sua empresa vende?  material de limpeza│ Buscar  │
└──────────────────────────────────────────────┴─────────┘
Município [Todos ▾]  Modalidade [Todas ▾]  Encerra em [Qualquer prazo ▾]

312 licitações abertas encontradas

┌──────────────────────────────────────────────────────────┐
│ Encerra em 3 dias · 25/11/2026 09:00          Pregão     │
│ Aquisição de material de limpeza e higienização para as  │
│ unidades de saúde do município...                        │
│ Prefeitura de Joinville · Joinville                      │
│ R$ 258.930,70 (estimado)              Ver no PNCP ↗      │
└──────────────────────────────────────────────────────────┘
...
           ‹ Anterior   Página 1 de 16   Próxima ›

Última coleta: 22/11/2026 às 14:02 · dados do PNCP · código no GitHub
```

- `src/app/page.tsx` é um Server Component. Ele lê os `searchParams`, valida com **Zod** (um valor
  inválido é ignorado, sem erro) e chama as duas funções pelo servidor.
- Filtro de prazo: "até 7 dias", "até 30 dias", "até 90 dias" ou "qualquer prazo" (padrão). Uma
  página além da última mostra a última.
- Busca e filtros num `<Form>` do `next/form`, que vira um GET com os parâmetros na URL. Funciona
  até sem JavaScript.
- Regras de exibição, como funções puras testadas:
  - valor nulo ou 0 → "Valor não informado";
  - encerramento a mais de 5 anos → "Prazo informado: 05/11/2125 (provável erro no PNCP)";
  - prazo relativo: "encerra hoje", "em 3 dias", "em 2 meses";
  - datas e moeda no formato brasileiro, sempre no horário de Brasília.
- Credenciamento aparece com uma explicação curta ("aceita fornecedores continuamente") e pode ser
  filtrado pela modalidade.
- "Ver no PNCP" abre a página oficial da licitação. O formato da URL será conferido com uma
  licitação real antes de entrar no código.
- `error.tsx` mostra "Não foi possível carregar as licitações agora" se o banco falhar, e a lista
  vazia tem uma mensagem própria.
- Cliente do Supabase em `src/lib/`, usado só no servidor. Variáveis `SUPABASE_URL` e
  `SUPABASE_PUBLISHABLE_KEY`, **sem** o prefixo `NEXT_PUBLIC_`, documentadas em
  `web/.env.example`. A chave é pública, mas fica no servidor porque o navegador não precisa dela.
- Visual: identidade própria, legível, acessível (rótulos, foco visível, contraste), com tema claro
  e escuro e `lang="pt-BR"`. Título e descrição da página para quando o link for compartilhado.

### Deploy na Vercel

1. O João cria a conta na Vercel entrando com o GitHub `demorojao` (plano Hobby, grátis).
2. Importa o repositório, com **Root Directory = `web`**.
3. Cadastra `SUPABASE_URL` e `SUPABASE_PUBLISHABLE_KEY` nas variáveis de ambiente do projeto.
4. Cada push na `main` publica o site, e cada branch ganha uma prévia. A região padrão (`iad1`, no
   leste dos EUA) fica perto do banco (`us-east-1`).
5. O link entra no README só depois de funcionar.

## Testes

- **Banco** (pytest, marcados `integracao`, rodam no CI):
  - sem acento e no plural, a busca encontra o texto com acento e no singular;
  - revogadas, anuladas, suspensas e vencidas nunca aparecem;
  - cada filtro funciona sozinho e combinado com os outros;
  - a paginação e o total estão certos;
  - texto com aspas, `OR` e símbolos não quebra a busca;
  - como `anon`, as funções executam e o RLS continua valendo;
  - `opcoes_de_filtro` conta só licitações abertas.
- **Site** (Vitest, novo job `npm test` no CI): validação dos parâmetros da URL, formatação de
  moeda e datas, prazo relativo, prazo suspeito e links de página que mantêm os filtros.
- Antes do deploy: build local e uma olhada na tela com dados reais (`npm run dev`).

## Documentação

- ADR 0008: a busca numa função SQL chamada pelo site.
- `docs/arquitetura.md`: o fluxo 2 ganha a busca por palavras ✅, e a busca por significado fica 📋.
- `README.md`: status da tela, link do site (depois do deploy) e como rodar o site com o
  `.env.local`.
- Guia de estudo atualizado no fim da etapa.

## Como entregar

No branch `tela`, em commits pequenos, com o CI verde em cada um. Depois, *fast-forward* para a
`main`, como foi feito com o banco.

## Decisões deixadas para quem implementa

- Nomes exatos dos componentes e arquivos dentro de `src/`.
- Os pesos da relevância e o texto dos estados vazios.
- Paleta e tipografia, seguindo as regras de acessibilidade acima.
