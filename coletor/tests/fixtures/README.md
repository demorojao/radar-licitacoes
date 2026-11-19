# Fixtures: respostas reais da API do PNCP

Os testes nunca chamam a API. Estes arquivos são respostas reais, gravadas em **18/11/2026**.
O JSON foi apenas indentado para facilitar a leitura: números e textos estão iguais aos da
resposta original (por exemplo, `225000.00` continua com duas casas decimais).

| Arquivo | Origem |
|---|---|
| `propostas_sc_pagina_1.json` | `GET /v1/contratacoes/proposta?dataFinal=99991231&uf=SC&pagina=1&tamanhoPagina=10` |
| `erro_400_tamanho_pagina.json` | a mesma URL com `tamanhoPagina=5` (a API exige de 10 a 50) |
| `propostas_sc_casos_especiais.json` | registros reais escolhidos entre as 2.704 contratações abertas de SC (todas as páginas), um por caso: prazo depois de 2099, campos com texto vazio, valor estimado zero, revogada, com valor homologado e de portal externo |

Casos sem arquivo, simulados nos testes:

- **HTTP 204 sem corpo:** a API responde assim depois da última página ou quando o filtro não
  encontra nada.
- **HTTP 429 e erros 5xx:** limite de uso e falhas temporárias, para testar a nova tentativa.
