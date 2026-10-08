import type { Metadata, Viewport } from "next";
import "leaflet/dist/leaflet.css";
import "./globals.css";
import SWRegister from "@/components/SWRegister";

export const metadata: Metadata = {
  title: "Preço Perto: o menor preço perto de você",
  applicationName: "Preço Perto",
  manifest: "/manifest.webmanifest",
  icons: { icon: [{ url: "/icons/favicon-32.png", sizes: "32x32" }, { url: "/icons/icon-192.png", sizes: "192x192" }], apple: "/icons/apple-touch-icon.png" },
  appleWebApp: { capable: true, title: "Preço Perto", statusBarStyle: "default" },
  description: "Digite qualquer produto e veja as lojas próximas (mercados, farmácias, pet shops, construção, autopeças, eletrônicos), o menor preço, a distância e se entregam.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0f9d58" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="antialiased">
        {children}
        <SWRegister />
      </body>
    </html>
  );
}
