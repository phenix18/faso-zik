"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  HiHome,
  HiMagnifyingGlass,
  HiMicrophone,
  HiMusicalNote,
  HiHeart,
  HiQueueList,
  HiVideoCamera,
  HiAdjustmentsHorizontal,
  HiBuildingStorefront,
  HiTrophy,
  HiBell,
  HiShieldCheck,
} from "react-icons/hi2";
import Logo from "@/components/Logo";

const LINKS = [
  { href: "/", label: "Accueil", icon: HiHome },
  { href: "/recherche", label: "Recherche", icon: HiMagnifyingGlass },
  { href: "/titres", label: "Titres", icon: HiMusicalNote },
  { href: "/clips", label: "Clips video", icon: HiVideoCamera },
  { href: "/artistes", label: "Artistes", icon: HiMicrophone },
  { href: "/classement", label: "Classement", icon: HiTrophy },
  { href: "/dj", label: "Platine DJ", icon: HiAdjustmentsHorizontal },
];

const PRIVATE_LINKS = [
  { href: "/nouveautes", label: "Nouveautes", icon: HiBell },
  { href: "/favoris", label: "Mes favoris", icon: HiHeart },
  { href: "/playlists", label: "Mes playlists", icon: HiQueueList },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();

  const item = (link) => {
    const active = pathname === link.href || (link.href !== "/" && pathname.startsWith(link.href));
    return (
      <Link
        key={link.href}
        href={link.href}
        className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
          active ? "bg-white/10 text-faso-gold" : "text-white/65 hover:bg-white/5 hover:text-white"
        }`}
      >
        <link.icon className="text-lg" />
        {link.label}
      </Link>
    );
  };

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-faso-line bg-faso-panel/60 px-3 pb-28 pt-4 lg:flex">
      <Link href="/" className="mb-6 px-2">
        <Logo />
      </Link>

      <nav className="flex flex-col gap-1">{LINKS.map(item)}</nav>

      {session?.user && (
        <>
          <p className="mb-1 mt-6 px-3 text-[11px] font-semibold uppercase tracking-wider text-white/30">
            Ma bibliotheque
          </p>
          <nav className="flex flex-col gap-1">{PRIVATE_LINKS.map(item)}</nav>
        </>
      )}

      <p className="mb-1 mt-6 px-3 text-[11px] font-semibold uppercase tracking-wider text-white/30">
        Espace artiste
      </p>
      <nav className="flex flex-col gap-1">
        {item({ href: "/studio", label: "Mon studio", icon: HiBuildingStorefront })}
        {session?.user?.role === "admin" &&
          item({ href: "/admin", label: "Administration", icon: HiShieldCheck })}
      </nav>

      <div className="mt-auto rounded-lg border border-faso-line bg-black/30 p-3 text-[11px] leading-relaxed text-white/45">
        Chaque artiste garde la main : ecoute, telechargement et usage en
        platine s&apos;activent titre par titre depuis le studio.
        <Link href="/droits" className="mt-2 block font-semibold text-faso-gold hover:underline">
          Droits et retrait →
        </Link>
      </div>
    </aside>
  );
}
