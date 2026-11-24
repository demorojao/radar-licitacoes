# Plano: calendário de encerramento e cara nova da tela

> Status: ✅ aprovado pelo João em 24/11/2026 (branch `visual`)

## Por que

1. **O filtro de prazo não ajudava quem vende.** "Até 7 dias" destaca as licitações mais
   apertadas, mas quem vende 1.000 máquinas de lavar não consegue preparar proposta, documentos e
   estoque para algo que encerra hoje. A pergunta dessa pessoa é outra: "até que dia eu consigo me
   preparar, e o que ainda dá tempo?". Além disso, na tela o filtro parecia quebrado. Escolher a
   opção não fazia nada até clicar em "Buscar". E, sem texto, a primeira página com "Até 7 dias"
   era idêntica à página sem filtro, porque a lista já vem ordenada pelo prazo (em 24/11/2026:
   2.672 sem filtro, 773 com "Até 7 dias").
2. **A tela não tem cara de produto.** Para o recrutador e para uma pequena empresa, ela precisa
   mostrar em segundos o que o Radar faz e o que ele tem de diferente: os sinônimos.

## Objetivos

### Calendário "Encerra a partir de"

- O calendário mostra o mês com **quantas licitações encerram em cada dia**. Essas contagens
  seguem a busca, o município e a modalidade escolhidos.
- Clicar no dia 15 mostra o que encerra **do dia 15 em diante** (decisão do João: opção B), com a
  lista ordenada pelo prazo, para as do dia 15 virem primeiro.
- Dias que já passaram ficam apagados e não são clicáveis. O dia escolhido fica destacado. Setas
  ‹ › trocam o mês. "Qualquer data" limpa a escolha.
- Tudo por link (`/?a_partir=2026-12-15&mes=2026-12`), então dá para mandar a busca por mensagem.
- O filtro antigo "Encerra em: até 7/30/90 dias" sai da tela.

### Cara nova

- **Município e modalidade** se aplicam ao escolher. O botão "Buscar" continua para o texto.
- **Linha de resumo** do que está filtrado ("47 licitações · encerram a partir de 15/12 ·
  Joinville"), com um "×" em cada filtro e "Limpar tudo".
- **"Experimente: remédio · carro · pneu · festa"** embaixo da busca. São links que mostram os
  sinônimos funcionando no primeiro clique.
- **Cabeçalho com identidade:** uma marca de radar desenhada em SVG, o nome e a contagem viva
  ("2.672 licitações abertas agora · atualizado hoje às 06:07").
- **Cartões com urgência visível:**
  - uma faixa lateral vermelha para hoje e amanhã, e âmbar para os próximos 7 dias;
  - o valor alinhado e em destaque;
  - a etiqueta de sinônimo, que já existe, mantida como está.
- **Estado vazio que ajuda:** sugere tirar filtros e mostra exemplos de busca.
- **Imagem de prévia do link** (Open Graph) com o nome e a frase do Radar, para o link ficar
  bonito no WhatsApp e no LinkedIn.

## Direção visual: "painel de prazos"

O João pediu uma tela mais forte e profissional. A direção:

- **O tempo é o protagonista.** O prazo de cada cartão e os números do calendário usam uma fonte
  condensada e forte (Barlow Condensed 700), como um painel de embarque. É o único elemento ousado;
  o resto fica sóbrio. O texto continua em Public Sans, desenhada para serviços públicos.
- **Faixa de topo em verde profundo, de ponta a ponta,** com a marca de radar, o nome, os números
  vivos ("2.672 abertas · 773 encerram nesta semana · atualizado hoje às 06:07") e a busca grande
  em branco, porque a busca é o produto.
- **No computador, duas colunas:** à esquerda, uma barra fixa com o calendário, o município e a
  modalidade; à direita, o resumo dos filtros e a lista. **No celular,** os filtros ficam acima
  da lista, com município e modalidade lado a lado. (Decisão da implementação: um `<details>`
  recolhido não fica aberto no computador sem duplicar os campos.)
- **Cores (tokens):** papel `#f4f6f3`, superfície `#ffffff`, tinta `#13201a`, verde profundo
  `#0b3d2a` (faixa), verde `#0b5d3b` (ações), verde-claro `#d8efe3` (etiquetas e calendário),
  âmbar `#b54708` (semana), alerta `#b42318` (hoje e amanhã). O tema escuro tem equivalentes. O
  calendário usa tons de verde: mais escuro, mais licitações encerram no dia.
- **Evitar:** cartões em caixas com sombra, rótulos em maiúsculas espaçadas, fonte monoespaçada e
  degradês.

## Fora do escopo

- Intervalo de datas ("de 10 a 20"). "A partir de" responde à pergunta de quem vende; um
  intervalo pode vir depois.
- Página de detalhe da licitação, alertas e análise com IA.

## Como funciona

### Banco (migration nova)

- A lógica de "quais licitações batem com texto, sinônimos, município e modalidade" sai de
  `buscar_contratacoes` e vai para uma função interna, reaproveitada pelas duas funções públicas.
  Assim a regra dos sinônimos fica num lugar só.
- `buscar_contratacoes` troca `p_prazo_dias` por `p_encerra_a_partir date`: o dia é contado no
  horário de Brasília, a partir de 00:00. Com data, a ordem é pelo prazo e depois pela
  relevância; sem data, continua como hoje. A assinatura muda, então a função é apagada e criada
  de novo na mesma transação.
- Uma função nova, `encerramentos_por_dia(p_texto, p_codigo_ibge, p_modalidade_id, p_mes date)`,
  devolve `(dia date, quantidade bigint)` para os dias do mês com alguma licitação aberta, no
  horário de Brasília.
- As duas são `security invoker`, com `search_path = ''`, e o `anon` pode executar.

### Site

- `lerFiltros` lê `a_partir` (`AAAA-MM-DD`, uma data válida) e `mes` (`AAAA-MM`). Data inválida
  ou que já passou é ignorada. `prazo` deixa de existir.
- O calendário é um Server Component: uma grade de 7 colunas, links e nenhum JavaScript.
- Os seletores que se aplicam sozinhos ficam num pequeno Client Component que envia o formulário
  ao mudar. Sem JavaScript, o botão "Buscar" continua funcionando.
- O visual segue os tokens que já existem: verde, papel, tinta e alerta, mais um âmbar novo para
  a semana. Tudo é conferido no tema claro e no escuro, no celular (500 px) e no computador.

## Testes

- **Banco (pytest, no CI):**
  - "a partir de" no limite do dia em Brasília: uma licitação que encerra às 23:30 do dia 14
    não entra, e uma das 00:30 do dia 15 entra;
  - com data, a ordem é pelo prazo, mesmo com texto;
  - `encerramentos_por_dia` conta por dia de Brasília, respeita texto, sinônimo e município, e
    ignora as encerradas;
  - os testes antigos da busca e dos sinônimos continuam verdes.
- **Site (Vitest):**
  - `lerFiltros` com data válida, inválida, passada e `mes` fora do formato;
  - a montagem da grade do mês: o primeiro dia na coluna certa e os meses de 28 a 31 dias;
  - os links mantêm os outros filtros.

## Documentação

ADR 0010 (calendário "a partir de" no lugar do filtro "até N dias", com o motivo), arquitetura,
README e guia de estudo.

## Como vai ser feito

Branch `visual`, criado a partir da `main` depois do merge dos sinônimos. Testes primeiro, CI
verde em cada commit, migration com `--dry-run`, conferência no Chrome e merge só com o OK do
João.
