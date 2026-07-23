import type { Metadata, Viewport } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Şehir Simülatörü",
  description: "İzometrik, çok oyunculu şehir ekonomi simülatörü",
};

export const viewport: Viewport = {
  themeColor: "#0d1220",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="tr" className="dark">
      <head>
        {/* Latin alt kümesi ilk boyamada gerekli; genişletilmiş küme bekleyebilir. */}
        <link
          rel="preload"
          href="/fonts/google-sans-flex-latin.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
      </head>
      <body className="overflow-hidden antialiased">{children}</body>
    </html>
  );
}
