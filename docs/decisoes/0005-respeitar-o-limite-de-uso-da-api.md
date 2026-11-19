# 0005. Respeitar o limite de uso da API do PNCP

- Status: aceita
- Data: 2026-11-18

## Contexto

A API do PNCP é um serviço público, gratuito e sem cadastro. Ela tem limite de uso, mas esse
limite não está documentado. Em 18/11/2026, baixando as páginas de contratações abertas de SC com
0,5 s de pausa, a API respondeu **429 (Too Many Requests)** na 43ª página. Novas tentativas depois
de 1, 2, 4 e 8 s também falharam. Com 3 s de pausa, nenhuma página recebeu 429. Detalhes em
[docs/api-pncp.md](../api-pncp.md).

## Decisão

- **Pausa de 3 s entre as páginas**, ou seja, menos de 20 pedidos por minuto.
- **Nova tentativa** em limite de uso (429), erro temporário do servidor (500, 502, 503, 504) e
  falha de rede, com **espera exponencial de 5, 10, 20, 40 e 80 s** (6 tentativas, teto de
  120 s por espera). Se a resposta trouxer `Retry-After` em segundos, essa espera é usada.
- **Erro 4xx (exceto 429) não é repetido:** indica um pedido errado, e repetir não resolve.
- **Limite de 500 páginas** por coleta, para um erro de paginação da API não virar um laço
  infinito.

A regra fica em `coletor/src/radar_coletor/cliente.py`.

## Alternativas consideradas

- **Pedir mais rápido, com várias páginas em paralelo.** Aumentaria os 429 e sobrecarregaria um
  serviço público.
- **Biblioteca de nova tentativa (como a tenacity).** A regra cabe em cerca de 20 linhas testáveis,
  sem dependência nova.

## Consequências

- A coleta completa (55 páginas em 18/11/2026) leva alguns minutos, o que não importa para uma
  execução diária.
- A função de espera é injetada no cliente, então os testes simulam 429 e erros 5xx sem esperar
  de verdade.
- Se o limite da API mudar, os valores padrão do `ClientePNCP` precisam ser revistos.
