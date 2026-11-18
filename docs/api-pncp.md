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

Consequências:

- Para pegar **todas** as contratações abertas, a coleta usa uma data bem no futuro.
- Existem registros com prazo **depois de 2099**: é dado sujo na própria fonte. O coletor precisa
  aceitar esses registros sem quebrar.
- Credenciamentos chegam a ficar abertos por anos.

## Itens e arquivos de uma contratação

Cada contratação é identificada pelo `numeroControlePNCP`, no formato
`{cnpj}-1-{sequencial}/{ano}`. Exemplo: `83755850000127-1-000006/2026`. O CNPJ do órgão, o ano e o
sequencial (campos `orgaoEntidade.cnpj`, `anoCompra` e `sequencialCompra`) montam as URLs abaixo.

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
3. **`/v1/contratacoes/publicacao`** (busca por data de publicação) exige
   `codigoModalidadeContratacao` e inclui contratações já encerradas. Por isso usamos `/proposta`.
4. **Nem todo PDF tem texto.** No edital testado (36 páginas), a biblioteca `pypdf` extraiu 123 mil
   caracteres. Já um documento escaneado é só imagem e não tem texto extraível. Ainda não medimos
   quantos editais são assim.
5. **Contratações de portais externos.** Algumas trazem o nome do portal no objeto, como
   "[Portal de Compras Públicas] - ...".
6. **Benefício para ME/EPP.** O item testado tinha `tipoBeneficio` 5 ("Não se aplica"). Os códigos
   de exclusividade para micro e pequenas empresas ainda precisam ser confirmados.
