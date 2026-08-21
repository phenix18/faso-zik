"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { HiXMark } from "react-icons/hi2";
import Logo from "@/components/Logo";

const LINKS = [
  ["/", "Accueil"],
  ["/recherche", "Recherche"],
  ["/titres", "Titres"],
  ["/clips", "Clips video"],
  ["/artistes", "Artistes"],
  ["/classement", "Classement"],
  ["/dj", "Platine DJ"],
  ["/nouveautes", "Nouveautes"],
  ["/favoris", "Mes favoris"],
  ["/playlists", "Mes playlists"],
  ["/studio", "Mon studio"],
  ["/droits", "Droits et retrait"],
];

export default function MobileNav({ open, onClose }) {
  const pathname = usePathname();
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <button
        type="button"
        aria-label="Fermer le menu"
        onClick={onClose}
        className="absolute inset-0 bg-black/70"
      />
      <nav className="absolute inset-y-0 left-0 flex w-72 flex-col gap-1 border-r border-faso-line bg-faso-panel p-4">
        <div className="mb-4 flex items-center justify-between">
          <Logo />
          <button type="button" onClick={onClose} aria-label="Fermer" className="text-2xl text-white/60">
            <HiXMark />
          </button>
        </div>
        {LINKS.map(([href, label]) => (
          <Link
            key={href}
            href={href}
            onClick={onClose}
            className={`rounded-lg px-3 py-2.5 text-sm font-medium ${
              pathname === href ? "bg-white/10 text-faso-gold" : "text-white/70 hover:bg-white/5"
            }`}
          >
            {label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
