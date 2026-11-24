import { ImageResponse } from "next/og";

// A prévia que aparece quando o link é mandado no WhatsApp ou no LinkedIn. Gerada no build, com a
// fonte padrão do next/og: não depende do banco nem de arquivo de fonte.

export const alt = "Radar de Licitações SC: licitações abertas em Santa Catarina";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const VERDE_PROFUNDO = "#0b3d2a";
const SOBRE_FAIXA = "#e8f3ec";
const APAGADO = "#a9c7b6";
const VERDE_VIVO = "#5cc08e";
const AMBAR = "#fdb022";

export default function Imagem() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          background: VERDE_PROFUNDO,
          color: SOBRE_FAIXA,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <svg width="88" height="88" viewBox="0 0 32 32">
            <circle cx="16" cy="16" r="14" fill="none" stroke={SOBRE_FAIXA} strokeOpacity="0.4" strokeWidth="1.5" />
            <circle cx="16" cy="16" r="9" fill="none" stroke={SOBRE_FAIXA} strokeOpacity="0.4" strokeWidth="1.5" />
            <circle cx="16" cy="16" r="4" fill="none" stroke={SOBRE_FAIXA} strokeOpacity="0.4" strokeWidth="1.5" />
            <path d="M16 16 L16 2 A14 14 0 0 1 29.31 11.67 Z" fill={SOBRE_FAIXA} fillOpacity="0.3" />
            <line x1="16" y1="16" x2="16" y2="2" stroke={SOBRE_FAIXA} strokeWidth="2" />
            <circle cx="21.8" cy="9.1" r="2.2" fill={AMBAR} />
          </svg>
          <div style={{ fontSize: 44, fontWeight: 700, color: "white" }}>Radar de Licitações SC</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ fontSize: 76, fontWeight: 800, color: "white", lineHeight: 1.05 }}>
            O que sua empresa vende?
          </div>
          <div style={{ fontSize: 34, color: APAGADO, maxWidth: 940 }}>
            Licitações abertas em Santa Catarina, com uma busca que entende a palavra do dia a dia.
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 20, fontSize: 30 }}>
          <div style={{ display: "flex", color: "white" }}>“remédio”</div>
          <div style={{ display: "flex", color: APAGADO }}>→</div>
          <div
            style={{
              display: "flex",
              padding: "8px 22px",
              borderRadius: 999,
              background: "rgba(92, 192, 142, 0.2)",
              color: VERDE_VIVO,
              fontWeight: 700,
            }}
          >
            Encontrada pelo sinônimo medicamento
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
