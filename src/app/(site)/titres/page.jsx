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

export default function TitresPage({ searchParams }) {
  const genre = searchParams?.genre || "";
  const tri = searchParams?.tri || "recent";
  const tracks = listTracks({ genre: genre || undefined, sort: tri, limit: 200 });
  const genres = listGenres();

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="section-title">Tous les titres</h1>
        <p className="text-xs text-white/40">{tracks.length} titre(s) au catalogue</p>
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
    </div>
  );
}
