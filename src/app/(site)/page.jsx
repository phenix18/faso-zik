import Link from "next/link";
import { listArtists } from "@/lib/repo/artists";
import { listGenres, listTracks } from "@/lib/repo/tracks";
import { albumsRecents } from "@/lib/repo/albums";
import Cover from "@/components/Cover";
import TrackGrid from "@/components/TrackGrid";
import TrackList from "@/components/TrackList";
import ArtistCard from "@/components/ArtistCard";
import SectionHeader from "@/components/SectionHeader";

export const dynamic = "force-dynamic";

export default function HomePage() {
  const nouveautes = listTracks({ limit: 12 });
  const populaires = listTracks({ sort: "populaire", limit: 8 });
  const clips = listTracks({ kind: "video", limit: 6 });
  const artistes = listArtists({ limit: 8 });
  const albums = albumsRecents(6);
  const genres = listGenres();

  return (
    <div className="flex flex-col gap-10">
      <section className="relative overflow-hidden rounded-2xl border border-faso-line bg-gradient-to-br from-faso-red/25 via-faso-panel to-faso-green/20 p-6 sm:p-10">
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-faso-gold">
          Faso musique
        </p>
        <h1 className="max-w-2xl text-2xl font-black leading-tight text-white sm:text-4xl">
          La scene burkinabe en ecoute libre, du coupe-decale au balafon.
        </h1>
        <p className="mt-3 max-w-xl text-sm text-white/60">
          Streaming audio et video, telechargement quand l&apos;artiste l&apos;autorise, et une
          platine DJ pour mixer le catalogue directement dans le navigateur.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/titres" className="btn-primary">
            Explorer le catalogue
          </Link>
          <Link href="/dj" className="btn-ghost">
            Ouvrir la platine DJ
          </Link>
          <Link href="/studio" className="btn-ghost">
            Je suis artiste
          </Link>
        </div>
      </section>

      {genres.length > 0 && (
        <section>
          <SectionHeader title="Genres" subtitle="Le catalogue par style" />
          <div className="flex flex-wrap gap-2">
            {genres.map((genre) => (
              <Link
                key={genre.genre}
                href={`/titres?genre=${encodeURIComponent(genre.genre)}`}
                className="chip hover:border-faso-gold/50 hover:text-white"
              >
                {genre.genre} <span className="text-white/30">{genre.n}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section>
        <SectionHeader
          title="Nouveautes"
          subtitle="Les derniers titres deposes par les artistes"
          href="/titres"
        />
        <TrackGrid
          tracks={nouveautes}
          empty="Le catalogue est vide. Lancez `npm run seed` ou publiez votre premier titre depuis le studio."
        />
      </section>

      {populaires.length > 0 && (
        <section>
          <SectionHeader title="Les plus ecoutes" href="/titres?tri=populaire" />
          <TrackList tracks={populaires} />
        </section>
      )}

      {albums.length > 0 && (
        <section>
          <SectionHeader title="Albums et EP" subtitle="Les sorties completes" />
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
            {albums.map((album) => (
              <Link
                key={album.id}
                href={`/artistes/${album.artist_slug}/${album.slug}`}
                className="group"
              >
                <span className="block aspect-square overflow-hidden rounded-xl border border-faso-line">
                  <Cover src={album.cover_url} alt={album.title} rounded="rounded-xl" />
                </span>
                <span className="mt-2 block truncate text-sm font-semibold text-white group-hover:text-faso-gold">
                  {album.title}
                </span>
                <span className="block truncate text-xs text-white/40">{album.artist_name}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {clips.length > 0 && (
        <section>
          <SectionHeader title="Clips video" href="/clips" />
          <TrackGrid tracks={clips} />
        </section>
      )}

      {artistes.length > 0 && (
        <section>
          <SectionHeader title="Artistes" href="/artistes" />
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
            {artistes.map((artist) => (
              <ArtistCard key={artist.id} artist={artist} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
