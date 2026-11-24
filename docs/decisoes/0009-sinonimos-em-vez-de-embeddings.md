# 0009. Sinônimos no Postgres em vez de busca por significado com IA

- Status: aceita
- Data: 2026-11-24

## Contexto

A busca por palavras (ADR 0008) falha quando quem busca usa a palavra do dia a dia e o edital usa
a palavra oficial. Medido em 24/11/2026, com 2.672 licitações abertas:

| Quem busca digita | Encontra | O edital diz | Encontra |
|---|---|---|---|
| remédio | 0 | medicamento | dezenas |
| carro | 4 | veículo | 140 |
| computador | 5 | informática | 8 |

O plano original era a busca por significado: gerar um *embedding* (uma lista de números que
representa o sentido do texto) de cada licitação e de cada busca com o Gemini, guardar no
pgvector e combinar com a busca por palavras.

## Decisão

Uma **tabela de sinônimos no Postgres**, `public.sinonimos` ("remédio" → medicamento, fármaco),
preenchida por migration a partir de medições nos dados reais ([docs/sinonimos.md](../sinonimos.md)).

- `buscar_contratacoes` reescreve a consulta com `ts_rewrite`, função nativa do Postgres, trocando
  cada termo por "termo OU equivalentes". Aspas (frase exata), `-palavra` (excluir) e `or`
  continuam funcionando.
- Quem entra só pelo sinônimo precisa ter a palavra **escrita** no objeto, e não só o mesmo
  radical. Sem essa regra, "remédio" trazia 185 licitações, e as 5 da amostra eram de consultas
  **médicas** ("medicamento" e "médico" viram ambos `medic`). Com ela, ficaram 47, todas de
  medicamento.
- A função devolve `sinonimos_usados`, e o site mostra a etiqueta "Encontrada pelo sinônimo
  medicamento". Quem visita entende por que aquela licitação apareceu.
- A IA fica para a análise do edital, onde ela é insubstituível.

## Alternativas consideradas

- **Embeddings com o Gemini e pgvector.** Cobre palavras que ninguém previu, mas exige chave, cota
  diária (cada busca de visitante gasta um pedido), cache, limite de uso e calibrar um corte de
  semelhança, porque a busca por significado sempre devolve algo. O resultado é menos previsível e
  mais difícil de testar.
- **Dicionário de sinônimos do próprio Postgres** (`synonym` ou `thesaurus`). Exige um arquivo no
  servidor do banco, e o Supabase não permite isso.
- **Sinônimos só no TypeScript**, montando a consulta antes de chamar o banco. Duplicaria a
  lógica da busca fora da função SQL, que é onde ela é testada (ADR 0008).

## Consequências

- Custo zero: sem chave, sem cota e sem serviço novo.
- Comportamento previsível e testado no CI ("remédio acha medicamento"; "consultas médicas" não
  entram).
- Só cobre o que está na lista. Acrescentar um par é uma migration, depois de medir.
- Casos que só o significado resolve continuam de fora: "carro → veículo" também traz
  "veículos de comunicação". Se a lista mostrar muitos limites assim, os embeddings voltam à mesa.
