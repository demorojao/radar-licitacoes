# Sinônimos da busca

Quem busca usa a palavra do dia a dia; o edital usa a palavra oficial. Em 24/11/2026, "remédio"
não achava nenhuma licitação aberta, e "medicamento" achava dezenas. A tabela `public.sinonimos`
liga as duas: quem busca "remédio" também encontra "medicamento", e a licitação mostra a etiqueta
**"Encontrada pelo sinônimo medicamento"**. A decisão está no
[ADR 0009](decisoes/0009-sinonimos-em-vez-de-embeddings.md).

## Regras

- **Direção.** `termo` é o que a pessoa digita; `equivalentes` são as palavras do edital. "carro"
  puxa "veículo", mas "veículo" não puxa "carro".
- **Palavras soltas**, só letras, dos dois lados. A busca já ignora acentos, maiúsculas e plurais
  do termo digitado.
- **Equivalente no singular e na forma de base** ("resíduo", "elétrica", "elétrico"). A licitação
  só entra pelo sinônimo se o **objeto** tiver uma palavra que **começa** com o equivalente: "resíduo"
  pega "resíduos", e "evento" pega "eventos", mas não "eventual". Se o feminino importa, ele entra
  como outra palavra ("odontológico", "odontológica").
- **Sem encadear.** Uma palavra não é termo numa linha e equivalente em outra.
- **Critério de aceite.** Um par só entra se acrescenta licitações e se uma amostra dos trechos onde
  o equivalente aparece não traz nada errado. Um sinônimo que traz resultado errado é pior que
  nenhum.

### Por que conferir a palavra escrita, e não só o radical

A busca reduz cada palavra ao radical. Às vezes, palavras de sentidos diferentes ficam com o mesmo
radical: "medicamento" e "médico" viram `medic`. Na primeira medição, com 2.672 licitações
abertas, "remédio → medicamento" trazia 185 licitações, e as 5 da amostra eram de consultas
médicas. Exigindo "medicament..." escrito no objeto, ficaram 47, todas de medicamento. O mesmo
problema aparecia com `event` ("eventual"), `conect` ("Escola Conectada") e `sanitari` ("aterro
sanitário"). A conferência olha só o objeto porque o nome do órgão enganava: o "Centro de
Informática e Automação do Estado" fazia qualquer compra dele aparecer para "computador".

## A lista (medida em 24/11/2026, 2.672 licitações abertas)

"Sozinho" é quanto o termo acha sem sinônimos. "Só por sinônimo" é quanto entra a mais, já com a
conferência da palavra escrita.

| Termo | Equivalentes | Sozinho | Só por sinônimo |
|---|---|---:|---:|
| adubo | fertilizante | 12 | 2 |
| aluguel | locação | 1 | 81 |
| asfalto | pavimentação | 69 | 50 |
| cachorro | canino, cão, cães | 0 | 45 |
| carro | veículo, automóvel, viatura | 4 | 128 |
| comida | alimentício, alimento | 33 | 74 |
| computador | informática, microcomputador, notebook, desktop | 5 | 7 |
| conserto | reparo, reparação | 22 | 35 |
| dentista | odontológico, odontológica, odontologia | 0 | 31 |
| eletricista | elétrica, elétrico | 13 | 79 |
| enfermeiro | enfermagem | 2 | 6 |
| festa | evento | 6 | 130 |
| fisioterapeuta | fisioterapia | 16 | 31 |
| impressora | impressão | 11 | 9 |
| jardinagem | roçada, paisagismo | 16 | 6 |
| limpeza | higienização, asseio, saneante | 75 | 7 |
| lixo | resíduo | 2 | 28 |
| luz | iluminação | 17 | 35 |
| moto | motocicleta | 2 | 6 |
| móveis | mobiliário | 64 | 20 |
| nutricionista | nutrição | 3 | 5 |
| padaria | panificação, panificados | 1 | 2 |
| papelaria | expediente | 16 | 5 |
| pedreiro | alvenaria | 29 | 3 |
| pintor | pintura | 8 | 49 |
| remédio | medicamento, fármaco | 0 | 47 |
| roupa | vestuário, fardamento | 5 | 2 |
| sapato | calçado | 0 | 1 |
| show | artístico, artística, musical | 7 | 45 |

Limite conhecido: "carro → veículo" também traz "credenciamento de **veículos de comunicação**"
(rádios e jornais). Ficou na lista porque a grande maioria é de frota, mas é o tipo de caso que a
busca por significado resolveria.

## Descartados

| Par | Motivo |
|---|---|
| remédio → medicamento, sem conferir a palavra | `medic` também é "médico": a amostra só tinha consultas médicas |
| conserto → manutenção | genérico: "combustível para manutenção da frota" |
| comida, merenda, lanche → alimentação | "alimentação do site institucional", "vale-alimentação" |
| curso → capacitação | quase sempre "capacitação de usuários" dentro de contratos de informática |
| encanador → hidráulica | "escavadeira hidráulica" |
| hotel → hospedagem | "hospedagem dos sistemas" (servidores) |
| gasolina → combustível | "combustível por conta do contratado" em aluguel de máquinas |
| vigia → vigilância | "vigilância em saúde" |
| banheiro → sanitário | "aterro sanitário" |
| câmera → monitoramento | "câmera" tem o radical de "câmara" (municipal); "monitores" de computador |
| ônibus → coletivo | "coletivos artísticos", "sanitários coletivos" |
| faxina → limpeza | "limpeza" já é termo: a reescrita encadearia |
| internet → conectividade, celular → smartphone, uniforme → fardamento, gás → GLP, advogado, contador, geladeira, televisão, psicólogo, fotógrafo, professor, tablet, xerox | acrescentavam 0, 1 ou 2 licitações |

## Como acrescentar um par

1. Meça como acima: quanto o termo acha sozinho, quanto entra só pelo sinônimo e uma amostra dos
   trechos onde o equivalente aparece no objeto.
2. Se passar no critério de aceite, crie uma migration nova com o `insert` (ou `update`) e
   acrescente a linha na tabela deste arquivo, com a data.
3. O teste `test_nenhuma_palavra_e_termo_e_equivalente` recusa um par que encadearia.
