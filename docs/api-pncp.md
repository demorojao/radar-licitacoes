# A API do PNCP: o que descobrimos testando

O PNCP (Portal Nacional de Contratações Públicas) publica as licitações de todo o país. Este
documento registra o que verificamos chamando a API de verdade, para o código não depender de
suposições.

> **Verificado em 18/11/2026.** Os números mudam todos os dias.

## Duas APIs, nenhuma exige cadastro

| API | Base | Para quê |
|---|---|---|
| Consulta | `https://pncp.gov.br/api/consulta` | buscar contratações por filtros (data, UF, modalidade) |
| PNCP | `https://pncp.gov.br/api/pncp` | detalhes de uma contratação: itens e arquivos (PDFs) |

A documentação da API de consulta fica em
<https://pncp.gov.br/api/consulta/swagger-ui/index.html>, e a especificação OpenAPI (o
"contrato" da API, em JSON) em <https://pncp.gov.br/api/consulta/v3/api-docs>.

## Endpoint principal: contratações com proposta aberta

`GET /v1/contratacoes/proposta`

| Parâmetro | Obrigatório | Observação |
|---|---|---|
| `dataFinal` | sim | `AAAAMMDD`. Traz as contratações cujo prazo de proposta **encerra até** essa data (veja abaixo) |
| `uf` | não | por exemplo, `SC` |
| `codigoModalidadeContratacao` | não | `6` = pregão eletrônico |
| `codigoMunicipioIbge` | não | |
| `pagina` | sim | começa em 1 |
| `tamanhoPagina` | não | **entre 10 e 50** |

A resposta traz `data` (a lista), `totalRegistros`, `totalPaginas`, `numeroPagina`,
`paginasRestantes` e `empty`.

### `dataFinal` significa "encerra até"

Com `uf=SC`, em 18/11/2026:

| `dataFinal` | `totalRegistros` |
|---|---|
| `20261130` | 1.037 |
| `20261231` | 1.787 |
| `20271231` | 2.283 |
| `20301231` | 2.519 |
| `20991231` | 2.681 |
| `21001231` | 2.685 |
| `99991231` | 2.704 |

Consequências:

- A API aceita `99991231`, e é essa data que a coleta usa para pegar **todas** as contratações
  abertas.
- Existem prazos de encerramento **depois de 2099**, até 2125: é dado sujo na própria fonte. O
  coletor aceita esses registros sem quebrar.
- Credenciamentos chegam a ficar abertos por anos.

### Sem conteúdo: HTTP 204

Depois da última página, ou quando o filtro não encontra nada, a API responde **HTTP 204 sem
corpo**, embora o cabeçalho diga `content-type: application/json`. Tentar ler esse corpo como JSON
dá erro, então o cliente trata o 204 antes.

### Limite de uso: HTTP 429

A API limita a quantidade de pedidos, e isso não aparece na documentação nem em cabeçalhos das
respostas normais. O que medimos em 18/11/2026, baixando as páginas de 50 itens:

- Com 0,5 s de pausa entre as páginas, a API respondeu **429 (Too Many Requests) na 43ª página**.
  Novas tentativas depois de 1, 2, 4 e 8 s (15 s no total) também receberam 429.
- Minutos depois, a mesma página respondeu 200.
- Com **3 s** de pausa, as 13 páginas restantes vieram sem nenhum 429.

Não chegamos a ver os cabeçalhos de uma resposta 429, então não sabemos se ela traz `Retry-After`.
O cliente respeita esse cabeçalho se ele vier. As escolhas estão no
[ADR 0005](decisoes/0005-respeitar-o-limite-de-uso-da-api.md).

## O que os dados mostram

Todas as 2.704 contratações de SC com proposta aberta em 18/11/2026, sem nenhum registro repetido
entre as páginas:

| Aspecto | Resultado |
|---|---|
| Modalidades | Credenciamento 1.148 · Pregão eletrônico 1.058 · Concorrência eletrônica 332 · Dispensa 92 · outras 74 |
| Situação | Divulgada no PNCP 2.661 · **Revogada 17 · Suspensa 15 · Anulada 11** |
| Municípios | 251 |
| Valor total estimado | sempre preenchido, sempre com 2 casas decimais; **167 com valor 0**; o maior é R$ 2.297.628.657,83 |
| Valor homologado | preenchido em 545 |
| Datas | todas no formato `AAAA-MM-DDTHH:MM:SS`, sem fuso |
| Prazo de encerramento | de 19/11/2026 a 05/11/2125; 169 depois de 2030 |
| Textos vazios (`""`) | `informacaoComplementar` em 839 registros, `linkSistemaOrigem` em 395 |
| Objeto | de 18 a 1.499 caracteres; 336 começam com o nome de um portal entre colchetes, como "[LICITANET]" |

Consequências para o código:

- O endpoint de propostas abertas também traz contratações **revogadas, suspensas e anuladas**. A
  situação é guardada, e o site precisa filtrar por ela.
- Texto vazio vira `None` na validação.
- Valor estimado 0 não significa "de graça": a tela deve mostrar "valor não informado".

## Itens e arquivos de uma contratação

Cada contratação é identificada pelo `numeroControlePNCP`, no formato
`{cnpj}-1-{sequencial}/{ano}`. Exemplo: `83755850000127-1-000006/2026`. Nas 2.704 contratações,
a chave sempre seguiu esse formato. O CNPJ do órgão, o ano e o sequencial (campos
`orgaoEntidade.cnpj`, `anoCompra` e `sequencialCompra`) montam as URLs abaixo.

- **Arquivos:** `GET /api/pncp/v1/orgaos/{cnpj}/compras/{ano}/{sequencial}/arquivos` devolve uma
  lista com `titulo`, `tipoDocumentoNome` (no teste: "Edital", "Termo de Referência", "Outros
  Documentos"), `statusAtivo` e `url`.
- **Download:** a `url` de cada arquivo devolve o conteúdo com
  `content-type: application/octet-stream` e o nome do arquivo no cabeçalho
  `content-disposition`. No teste, era um PDF.
- **Itens:** `GET /api/pncp/v1/orgaos/{cnpj}/compras/{ano}/{sequencial}/itens?pagina=1&tamanhoPagina=N`
  traz `descricao`, `quantidade`, `unidadeMedida`, `valorUnitarioEstimado`, `valorTotal`,
  `materialOuServicoNome`, `criterioJulgamentoNome`, `tipoBeneficioNome` e `orcamentoSigiloso`,
  entre outros campos.

## Armadilhas

1. **Datas sem fuso.** `"2026-11-27T08:30:00"` está no horário de Brasília. Tratada como UTC, o
   prazo fica 3 horas errado. Resolvido em
   [`coletor/src/radar_coletor/datas.py`](../coletor/src/radar_coletor/datas.py).
2. **`tamanhoPagina` menor que 10** devolve erro 400 ("must be greater than or equal to 10").
3. **HTTP 204 sem corpo** no fim da paginação.
4. **Limite de uso (429)** sem aviso prévio.
5. **Valores em dinheiro.** Lidos como float, valores muito grandes perdem precisão. O cliente lê
   o JSON com `parse_float=Decimal`.
6. **`/v1/contratacoes/publicacao`** (busca por data de publicação) exige
   `codigoModalidadeContratacao` e inclui contratações já encerradas. Por isso usamos `/proposta`.
7. **Nem todo PDF tem texto.** No edital testado (36 páginas), a biblioteca `pypdf` extraiu 123 mil
   caracteres. Já um documento escaneado é só imagem e não tem texto extraível. Ainda não medimos
   quantos editais são assim.
8. **Benefício para ME/EPP.** O item testado tinha `tipoBeneficio` 5 ("Não se aplica"). Os códigos
   de exclusividade para micro e pequenas empresas ainda precisam ser confirmados.
