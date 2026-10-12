import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

export const metadata: Metadata = {
  title: "Livro dos Sonhos · consulta editorial de sonhos e números",
  description:
    "Lembrou do sonho? Encontre o verbete e consulte as associações no mesmo lugar. Índice A–Z, tabela dos 25 bichos, gerador de combinações e o livro original.",
  applicationName: "Livro dos Sonhos",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icons/icon-64.png", sizes: "64x64", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: "/icons/apple-touch-icon.png",
  },
  openGraph: {
    title: "Livro dos Sonhos",
    description: "Consulta editorial de sonhos com os verbetes e números do livro original.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#321053",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <style
          dangerouslySetInnerHTML={{
            __html: `:root { --font-ui-sans: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; --font-ui-serif: Georgia, 'Times New Roman', serif; }`,
          }}
        />
      </head>
      <body className="antialiased bg-background text-foreground min-h-screen">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
