"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { HiMagnifyingGlass, HiUserCircle, HiBars3 } from "react-icons/hi2";
import Logo from "@/components/Logo";
import MobileNav from "@/components/MobileNav";

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session } = useSession();
  const [query, setQuery] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);

  function submit(event) {
    event.preventDefault();
    if (query.trim()) router.push(`/recherche?q=${encodeURIComponent(query.trim())}`);
  }

  return (
    <header className="sticky top-0 z-40 border-b border-faso-line bg-faso-ink/85 backdrop-blur-xl">
      <div className="flex items-center gap-3 px-3 py-3 sm:px-5">
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          className="p-1 text-2xl text-white/70 lg:hidden"
          aria-label="Ouvrir le menu"
        >
          <HiBars3 />
        </button>

        <Link href="/" className="lg:hidden">
          <Logo />
        </Link>

        <form onSubmit={submit} className="ml-auto flex w-full max-w-md items-center lg:ml-0">
          <div className="relative w-full">
            <HiMagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/35" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Rechercher un titre, un artiste, un genre..."
              aria-label="Rechercher"
              className="input pl-9"
            />
          </div>
        </form>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          {session?.user ? (
            <>
              <Link
                href="/compte"
                className="hidden text-sm font-semibold text-white/70 hover:text-white sm:block"
              >
                {session.user.name}
              </Link>
              <button
                type="button"
                onClick={() => signOut({ callbackUrl: "/" })}
                className="btn-ghost !px-3 !py-1.5"
              >
                Deconnexion
              </button>
            </>
          ) : (
            <>
              <Link
                href={`/connexion?callbackUrl=${encodeURIComponent(pathname || "/")}`}
                className="btn-ghost !px-3 !py-1.5"
              >
                <HiUserCircle className="text-lg" /> Connexion
              </Link>
              <Link href="/inscription" className="btn-primary !px-3 !py-1.5">
                Rejoindre
              </Link>
            </>
          )}
        </div>
      </div>

      <MobileNav open={menuOpen} onClose={() => setMenuOpen(false)} />
    </header>
  );
}
