"use client";

import { type ComponentProps, useRef, useState } from "react";

import { deveEnviar } from "@/lib/envio-do-seletor";

type Props = Omit<ComponentProps<"select">, "value" | "defaultValue" | "onChange"> & {
  /** O valor que está na URL agora. */
  valor: string;
};

/**
 * Um <select> que aplica o filtro sozinho: com mouse ou toque, ao escolher; pelo teclado, com
 * Enter ou ao sair do campo (regra em `envio-do-seletor.ts`). O valor é controlado e segue a URL,
 * então o campo não é recriado a cada busca e o foco não se perde.
 */
export function SeletorQueEnvia({ valor, ...props }: Props) {
  const [atual, setAtual] = useState(valor);
  const [daUrl, setDaUrl] = useState(valor);
  // A URL mudou por outro caminho (um "×" no resumo, por exemplo): o seletor acompanha.
  if (valor !== daUrl) {
    setDaUrl(valor);
    setAtual(valor);
  }
  const peloTeclado = useRef(false);

  function enviar(evento: "change" | "enter" | "saiu", seletor: HTMLSelectElement) {
    const mudou = seletor.value !== valor;
    if (deveEnviar({ evento, peloTeclado: peloTeclado.current, mudou })) {
      seletor.form?.requestSubmit();
    }
  }

  return (
    <select
      {...props}
      value={atual}
      onPointerDown={() => {
        peloTeclado.current = false;
      }}
      onKeyDown={(evento) => {
        peloTeclado.current = true;
        if (evento.key === "Enter") {
          evento.preventDefault();
          enviar("enter", evento.currentTarget);
        }
      }}
      onChange={(evento) => {
        setAtual(evento.currentTarget.value);
        enviar("change", evento.currentTarget);
      }}
      onBlur={(evento) => enviar("saiu", evento.currentTarget)}
    />
  );
}
