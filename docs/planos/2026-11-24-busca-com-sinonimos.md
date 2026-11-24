# Plano: busca com sinônimos

> Status: ✅ aprovado pelo João em 24/11/2026 (branch `sinonimos`)

## Por que

A busca por palavras falha quando quem busca usa a palavra do dia a dia e o edital usa a palavra
oficial. Medido em 24/11/2026, com 2.672 licitações abertas:

| Quem busca digita | Encontra | O edital diz | Encontra |
|---|---|---|---|
| remédio | 0 | medicamento | 185 |
| carro | 4 | veículo | 140 (136 sem "carro") |
| computador | 5 | informática | 8 |
| limpeza | 75 | higienização | 14 (6 sem "limpeza") |

## Decisão: sinônimos, e não embeddings

Consideramos duas abordagens:

- **Embeddings (busca por significado com o Gemini).** Cobre palavras que ninguém previu, mas
  exige chave, cota diária, cache, limite de uso e calibrar um corte de semelhança. O resultado é
  menos previsível.
- **Tabela de sinônimos no Postgres (escolhida).** Custo zero, sem chave e sem cota. É previsível e
  testável ("remédio acha medicamento"), e a etiqueta explica o motivo de cada resultado. Só cobre
  o que está na lista.

O João escolheu os sinônimos. A IA fica para a análise do edital, onde ela é insubstituível.
Os embeddings continuam possíveis no futuro, se a lista mostrar limites. Isso vira o ADR 0009.

## Objetivos

- Buscar "remédio" encontra as licitações de medicamento; "carro" encontra as de veículo.
- Cada licitação que entrou só por um sinônimo mostra uma etiqueta:
  **"Encontrada pelo sinônimo medicamento"**.
- Acentos, plurais, aspas (frase exata), `-palavra` (excluir) e `or` continuam funcionando.
- A lista inicial de sinônimos vem de medição nos dados reais, e não de chute.

## Fora do escopo

- Embeddings e busca por significado.
- Editar sinônimos pelo site. A lista muda por migration, revisada como código.
- Sinônimos com mais de uma palavra ("material de limpeza"). A primeira versão trabalha com
  palavras soltas dos dois lados.

## Anti-objetivo

Um sinônimo que traz resultado errado é pior que nenhum. Exemplo medido: o radical de
"medicamento" é `medic`, o mesmo de "médico". Cada sinônimo entra só depois de conferir a contagem
e uma amostra de títulos.

## Como funciona

### Banco (migration nova)

- Tabela `public.sinonimos`: `termo text primary key` (o que a pessoa digita) e
  `equivalentes text[] not null` (as palavras que o edital usa). A relação tem direção: "carro" →
  "veículo", "automóvel". Guarda as palavras como se escreve, com acento. A normalização acontece na
  hora de buscar.
- RLS ligado, com política de leitura para `anon` e `authenticated`, como nas outras tabelas. A
  função de busca é `security invoker` e precisa ler a tabela.
- A lista inicial entra na mesma migration.
- `buscar_contratacoes` passa a:
  1. montar a consulta original como hoje
     (`websearch_to_tsquery(..., normalizar_para_busca(p_texto))`);
  2. montar a consulta expandida com `ts_rewrite`, trocando cada termo da tabela por "termo OU
     equivalentes". Testado em produção em 24/11/2026: plural ("remédios"), exclusão
     ("carro -elétrico") e frase ("aluguel de carro") continuam certos;
  3. filtrar e ordenar pela consulta expandida, com a mesma relevância, a mesma ordem e a mesma
     paginação de hoje. Resultados por sinônimo se misturam aos outros pela relevância. Assim o
     achado aparece na primeira página;
  4. devolver uma coluna nova, `sinonimos_usados text[]`: vazia quando a licitação bate com a
     consulta original; senão, os equivalentes (escritos como na tabela) que a fizeram entrar.

### Lista inicial

1. Medir as palavras mais comuns nos objetos das licitações abertas (`ts_stat` sobre a coluna
   `busca`).
2. Para cada palavra oficial frequente, propor a palavra do dia a dia (veículo ← carro,
   medicamento ← remédio).
3. Aceitar o par só se ele acrescenta resultados e se uma amostra de 5 títulos não traz nada
   errado.
4. Registrar a lista com as contagens e a data em `docs/sinonimos.md`.

Meta: de 30 a 50 termos, o suficiente para cobrir as palavras mais buscadas, e não um dicionário.

### Site

- O Zod da linha da busca ganha `sinonimos_usados: string[]`.
- `ItemDeLicitacao` mostra a etiqueta quando a lista não está vazia: "Encontrada pelo sinônimo
  medicamento" ou "Encontrada pelos sinônimos veículo e automóvel".
- O resto da tela não muda.

## Testes

- **Banco (pytest, no CI):**
  - "remédio" acha uma licitação de medicamento e devolve `sinonimos_usados = {medicamento}`;
  - licitação que tem a palavra digitada vem com a lista vazia;
  - plural e acento no termo digitado ("remédios");
  - exclusão e frase preservadas;
  - palavra sem sinônimo funciona como antes;
  - `anon` lê `sinonimos` e não consegue gravar.
- **Site (Vitest):** o esquema aceita e valida `sinonimos_usados`; o texto da etiqueta no singular
  e no plural.

## Documentação

ADR 0009 (sinônimos em vez de embeddings, com a medição), `docs/sinonimos.md`,
`docs/arquitetura.md` (fluxo da busca), README (status) e o guia de estudo.

## Como vai ser feito

Branch `sinonimos`, testes primeiro, CI verde em cada commit. A migration é aplicada em produção
com `db push --dry-run` antes. Merge na `main` só com o OK do João.
