import Link from "next/link";
import { SITE_NAME, SITE_TAGLINE } from "@/lib/siteConfig";

/** Pied de page : mentions et acces au retrait de contenu. */
export default function PiedDePage() {
  return (
    <footer className="mt-16 border-t border-faso-line px-3 py-8 text-xs text-white/40 sm:px-5">
      <div className="mx-auto flex max-w-[1600px] flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p>
          <span className="font-semibold text-white/60">
            {SITE_NAME} — {SITE_TAGLINE}
          </span>
          <br />
          Les droits de chaque morceau appartiennent a son artiste.
        </p>
        <div className="flex flex-wrap items-center gap-4">
          <Link href="/droits" className="hover:text-faso-gold hover:underline">
            Droits et retrait
          </Link>
          <span>&copy; Korogo 2026</span>
        </div>
      </div>
    </footer>
  );
}
