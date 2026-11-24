/**
 * Quando um seletor de filtro aplica a escolha sozinho. Com mouse ou toque, ao escolher. Pelo
 * teclado, as setas trocam o valor a cada toque: aplicar a cada seta faria a página recarregar e o
 * foco sumir (WCAG 3.2.2). Por isso, pelo teclado, aplica só com Enter ou ao sair do campo.
 */
export function deveEnviar({
  evento,
  peloTeclado,
  mudou,
}: {
  evento: "change" | "enter" | "saiu";
  peloTeclado: boolean;
  mudou: boolean;
}): boolean {
  if (!mudou) return false;
  if (evento === "change") return !peloTeclado;
  return true;
}
