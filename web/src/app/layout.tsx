import type { Metadata } from "next";
import { Public_Sans } from "next/font/google";
import "./globals.css";

// Public Sans: fonte feita para serviços públicos digitais, com números tabulares.
const publicSans = Public_Sans({
  variable: "--font-public-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Radar de Licitações SC",
  description: "Licitações abertas em Santa Catarina, atualizadas todo dia.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${publicSans.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">{children}</body>
    </html>
  );
}
