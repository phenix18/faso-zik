import { notFound } from "next/navigation";
import { HiCheckBadge } from "react-icons/hi2";
import { artistStats, getArtistBySlug } from "@/lib/repo/artists";
import { listTracks } from "@/lib/repo/tracks";
import TrackList from "@/components/TrackList";
import TrackGrid from "@/components/TrackGrid";
import SectionHeader from "@/components/SectionHeader";
import SoutenirArtiste from "@/components/SoutenirArtiste";
import { formatCount } from "@/lib/format";

export const dynamic = "force-dynamic";

export function generateMetadata({ params }) {
  const artist = getArtistBySlug(params.slug);
  return {
    title: artist ? artist.name : "Artiste introuvable",
    description: artist?.bio || `Ecoutez ${artist?.name || "cet artiste"} sur FASO-ZIK.`,
  };
}

export default function ArtistPage({ params }) {
  const artist = getArtistBySlug(params.slug);
  if (!artist) notFound();

  const tracks = listTracks({ artistId: artist.id, limit: 200 });
  const audios = tracks.filter((track) => track.kind === "audio");
  const videos = tracks.filter((track) => track.kind === "video");
  const stats = artistStats(artist.id);

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col items-center gap-5 rounded-2xl border border-faso-line bg-gradient-to-br from-faso-panel to-black p-6 sm:flex-row sm:items-end">
        <span className="h-28 w-28 shrink-0 overflow-hidden rounded-full border-2 border-faso-gold/40">
          {artist.photo_url ? (
            <img src={artist.photo_url} alt={artist.name} className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full w-full items-center justify-center bg-gradient-to-br from-faso-red/60 to-faso-green/50 text-3xl font-black text-white">
              {artist.name.slice(0, 2).toUpperCase()}
            </span>
          )}
        </span>

        <div className="min-w-0 flex-1 text-center sm:text-left">
          <p className="text-xs font-semibold uppercase tracking-widest text-faso-gold">Artiste</p>
          <h1 className="flex items-center justify-center gap-2 text-2xl font-black text-white sm:justify-start sm:text-3xl">
            {artist.name}
            {!!artist.verified && <HiCheckBadge className="text-faso-gold" title="Artiste verifie" />}
          </h1>
          <p className="mt-1 text-sm text-white/50">
            {[artist.city, artist.country, artist.genres].filter(Boolean).join(" · ")}
          </p>
          {artist.bio && <p className="mt-3 max-w-2xl text-sm text-white/65">{artist.bio}</p>}
          <div className="mt-4 flex flex-wrap justify-center gap-2 sm:justify-start">
            <span className="chip">{stats.tracks} titre(s)</span>
            <span className="chip">{formatCount(stats.plays)} ecoutes</span>
            <span className="chip">{formatCount(stats.downloads)} telechargements</span>
            <span className="chip">{stats.downloadable} titre(s) telechargeable(s)</span>
          </div>
          <SoutenirArtiste artist={{ id: artist.id, name: artist.name }} />
        </div>
      </header>

      {audios.length > 0 && (
        <section>
          <SectionHeader title="Titres" />
          <TrackList tracks={audios} />
        </section>
      )}

      {videos.length > 0 && (
        <section>
          <SectionHeader title="Clips" />
          <TrackGrid tracks={videos} />
        </section>
      )}

      {!tracks.length && (
        <p className="rounded-lg border border-dashed border-faso-line p-6 text-sm text-white/40">
          Cet artiste n&apos;a pas encore publie de titre.
        </p>
      )}
    </div>
  );
}
