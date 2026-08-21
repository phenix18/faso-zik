import Link from "next/link";
import { listGenres, listTracks } from "@/lib/repo/tracks";
import TrackList from "@/components/TrackList";

export const dynamic = "force-dynamic";
export const metadata = { title: "Tous les titres" };

const TRIS = [
  ["recent", "Nouveautes"],
  ["populaire", "Les plus ecoutes"],
  ["titre", "Ordre alphabetique"],
];

const PAR_PAGE = 50;

export default function TitresPage({ searchParams }) {
  const genre = searchParams?.genre || "";
  const tri = searchParams?.tri || "recent";
  const page = Math.max(1, Number(searchParams?.page) || 1);

  // Une page de plus est demandee pour savoir s'il y a une suite, sans avoir a
  // compter tout le catalogue.
  const lot = listTracks({
    genre: genre || undefined,
    sort: tri,
    limit: PAR_PAGE + 1,
    offset: (page - 1) * PAR_PAGE,
  });
  const tracks = lot.slice(0, PAR_PAGE);
  const suite = lot.length > PAR_PAGE;
  const genres = listGenres();

  const lien = (numero) => {
    const parametres = new URLSearchParams({ tri });
    if (genre) parametres.set("genre", genre);
    if (numero > 1) parametres.set("page", String(numero));
    return `/titres?${parametres}`;
  };

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="section-title">Tous les titres</h1>
        <p className="text-xs text-white/40">
          {tracks.length} titre(s) affiche(s){page > 1 ? ` — page ${page}` : ""}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {TRIS.map(([value, label]) => (
          <Link
            key={value}
            href={`/titres?tri=${value}${genre ? `&genre=${encodeURIComponent(genre)}` : ""}`}
            className={`chip ${tri === value ? "border-faso-gold/60 text-faso-gold" : ""}`}
          >
            {label}
          </Link>
        ))}
        <span className="mx-1 w-px bg-faso-line" />
        <Link href={`/titres?tri=${tri}`} className={`chip ${!genre ? "border-faso-gold/60 text-faso-gold" : ""}`}>
          Tous genres
        </Link>
        {genres.map((item) => (
          <Link
            key={item.genre}
            href={`/titres?tri=${tri}&genre=${encodeURIComponent(item.genre)}`}
            className={`chip ${genre === item.genre ? "border-faso-gold/60 text-faso-gold" : ""}`}
          >
            {item.genre}
          </Link>
        ))}
      </div>

      <TrackList tracks={tracks} empty="Aucun titre ne correspond a ce filtre." />

      {(page > 1 || suite) && (
        <nav className="flex items-center justify-between gap-3" aria-label="Pagination">
          {page > 1 ? (
            <Link href={lien(page - 1)} className="btn-ghost">
              ← Page precedente
            </Link>
          ) : (
            <span />
          )}
          {suite && (
            <Link href={lien(page + 1)} className="btn-ghost">
              Page suivante →
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}
