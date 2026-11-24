import type { Metadata } from "next";
import { Barlow_Condensed, Public_Sans } from "next/font/google";
import "./globals.css";

// Public Sans: fonte feita para serviços públicos digitais, com números tabulares.
const publicSans = Public_Sans({
  variable: "--font-public-sans",
  subsets: ["latin"],
});

// Barlow Condensed: só para prazos e números, como num painel de embarque.
const barlowCondensed = Barlow_Condensed({
  variable: "--font-barlow-condensed",
  subsets: ["latin"],
  weight: ["600", "700"],
});

const DESCRICAO =
  "Licitações abertas em Santa Catarina, atualizadas todo dia, com uma busca que entende a palavra do dia a dia.";

export const metadata: Metadata = {
  // Base dos endereços absolutos da prévia do link (Open Graph).
  metadataBase: new URL("https://radar-licitacoes-sc.vercel.app"),
  title: "Radar de Licitações SC",
  description: DESCRICAO,
  openGraph: {
    title: "Radar de Licitações SC",
    description: DESCRICAO,
    locale: "pt_BR",
    type: "website",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${publicSans.variable} ${barlowCondensed.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">{children}</body>
    </html>
  );
}
