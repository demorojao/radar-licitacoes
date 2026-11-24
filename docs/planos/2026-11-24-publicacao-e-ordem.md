# Plano: data de publicação e ordenação

> Status: ✅ aprovado pelo João e implementado em 24/11/2026 (branch `publicacao`)

## Por que

O João viu um credenciamento publicado em 25/11/2025 que ainda está aberto até 24/12/2026 e
sentiu falta de saber quando cada licitação foi publicada. Quem procura oportunidades também
quer ver primeiro o que acabou de sair.

## O que muda

1. **Data de publicação no cartão:** "Publicada em 25/11/2025", logo abaixo do órgão, quando o
   PNCP informa a data (`data_publicacao`, que o banco já guarda).
2. **"Ordenar por"** na barra lateral, junto de município e modalidade:
   - Prazo mais próximo
   - Mais relevantes (só aparece com texto na busca)
   - Publicadas recentemente
   - Publicadas há mais tempo

   Sem escolha, vale o padrão de hoje: relevância com texto, prazo sem texto, e prazo quando há
   uma data no calendário. A escolha vai na URL (`ordem=recentes`). Licitação sem data de
   publicação vai para o fim nas duas ordens por publicação.

## Como

- `buscar_contratacoes` ganha `p_ordem text` e devolve `data_publicacao`. A assinatura muda, então
  a função é apagada e criada de novo na mesma transação; os parâmetros de hoje continuam
  funcionando, para o site no ar não quebrar antes do merge. Ordem desconhecida vira o padrão.
- O site lê `ordem` da URL com Zod (só os 4 valores), passa para o banco e mostra a data.

## Testes

- Banco: as quatro ordens; sem data de publicação vai para o fim; ordem desconhecida vira o padrão;
  a data de publicação vem na resposta.
- Site: `lerFiltros` aceita só as 4 ordens; o link mantém a ordem; o esquema aceita
  `data_publicacao` nula.
