import type { Metadata, Viewport } from "next";
import "leaflet/dist/leaflet.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Preço Perto: o menor preço perto de você",
  description: "Digite qualquer produto e veja as lojas próximas (mercados, farmácias, pet shops, construção, autopeças, eletrônicos), o menor preço, a distância e se entregam.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0f9d58" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="antialiased">{children}</body>
    </html>
  );
}
