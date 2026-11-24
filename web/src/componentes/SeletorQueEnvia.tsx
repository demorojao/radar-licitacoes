"use client";

import type { ComponentProps } from "react";

/**
 * Um <select> que aplica o filtro ao escolher, sem precisar clicar em "Buscar". Sem JavaScript,
 * vira um <select> comum, e o botão "Aplicar filtros" (no <noscript>) envia o formulário.
 */
export function SeletorQueEnvia(props: ComponentProps<"select">) {
  return <select {...props} onChange={(evento) => evento.currentTarget.form?.requestSubmit()} />;
}
