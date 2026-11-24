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

export const metadata: Metadata = {
  title: "Radar de Licitações SC",
  description: "Licitações abertas em Santa Catarina, atualizadas todo dia.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${publicSans.variable} ${barlowCondensed.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">{children}</body>
    </html>
  );
}
