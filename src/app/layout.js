import { Inter } from "next/font/google";
import "./globals.css";
import Providers from "@/redux/Providers";
import { reprendreTranscodagesInacheves } from "@/lib/transcodeQueue";
import { SITE_URL } from "@/lib/siteConfig";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "FASO-ZIK — la musique du Faso en streaming",
    template: "%s | FASO-ZIK",
  },
  description:
    "FASO-ZIK diffuse les titres et les clips des artistes burkinabe : ecoute en ligne, telechargement quand l'artiste l'autorise, espace artiste et platine DJ integree.",
  keywords: [
    "musique burkinabe",
    "streaming Burkina Faso",
    "FASO-ZIK",
    "clips africains",
    "platine DJ en ligne",
  ],
  openGraph: {
    type: "website",
    locale: "fr_BF",
    siteName: "FASO-ZIK",
    title: "FASO-ZIK — la musique du Faso en streaming",
    description:
      "Ecoutez, regardez et mixez les artistes du Faso. Telechargement sous autorisation de l'artiste.",
  },
  robots: { index: true, follow: true },
  manifest: "/manifest.json",
  icons: {
    icon: [{ url: "/favicon.png", type: "image/png" }],
    apple: [{ url: "/icone-192.png" }],
  },
  appleWebApp: {
    capable: true,
    title: "FASO-ZIK",
    statusBarStyle: "black-translucent",
  },
};

export const viewport = {
  themeColor: "#0B0D10",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }) {
  // Premiere page servie apres un demarrage : on relance les transcodages
  // qu'un arret aurait interrompus. Sans effet les fois suivantes.
  reprendreTranscodagesInacheves();

  return (
    <html lang="fr" className={inter.variable}>
      <body className="min-h-screen bg-faso-ink font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
