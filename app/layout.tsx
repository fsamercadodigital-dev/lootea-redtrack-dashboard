import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Lootea · Criativos Meta",
  description: "Painel de decisão de criativos Meta por primeiro depósito.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
