import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";

import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin", "latin-ext"], // latin-ext: Türkçe ı, ğ, ş, ç karakterleri
});

export const metadata: Metadata = {
  title: "Şehir Simülatörü",
  description: "İzometrik, çok oyunculu şehir ekonomi simülatörü",
};

export const viewport: Viewport = {
  themeColor: "#0f172a",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="tr" className="dark">
      <body className={`${inter.variable} overflow-hidden antialiased`}>{children}</body>
    </html>
  );
}
