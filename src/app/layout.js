import { Inter } from "next/font/google";
import "./globals.css";
import Providers from "@/redux/Providers";
import Navbar from "@/components/Navbar";
import Sidebar from "@/components/Sidebar";
import GlobalPlayer from "@/components/player/GlobalPlayer";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

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
};

export const viewport = {
  themeColor: "#0B0D10",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="fr" className={inter.variable}>
      <body className="min-h-screen bg-faso-ink font-sans antialiased">
        <Providers>
          <Sidebar />
          <div className="lg:pl-60">
            <Navbar />
            <main className="mx-auto max-w-[1600px] px-3 pb-40 pt-4 sm:px-5">{children}</main>
          </div>
          <GlobalPlayer />
        </Providers>
      </body>
    </html>
  );
}
