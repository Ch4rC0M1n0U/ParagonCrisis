import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ParagonCrisis",
  description:
    "Plateforme de simulation de crise en temps réel pour formateurs et participants.",
  openGraph: {
    title: "ParagonCrisis",
    description:
      "Orchestrez rooms, événements et alertes sonores pour entraîner vos équipes.",
    type: "website",
    locale: "fr_FR",
  },
  metadataBase: new URL("https://paragon-crisis.local"),
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" data-theme="paragon">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
