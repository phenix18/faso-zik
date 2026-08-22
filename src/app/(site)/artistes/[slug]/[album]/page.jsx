import Link from "next/link";
import { notFound } from "next/navigation";
import { HiCheckBadge } from "react-icons/hi2";
import { albumParSlug, titresAlbum } from "@/lib/repo/albums";
import TrackList from "@/components/TrackList";
import Cover from "@/components/Cover";
import DonneesStructurees from "@/components/DonneesStructurees";
import { SITE_NAME, SITE_URL } from "@/lib/siteConfig";
import { formatDuration } from "@/lib/format";

export const dynamic = "force-dynamic";

const LIBELLES = { album: "Album", ep: "EP", single: "Single", compilation: "Compilation" };

export async function generateMetadata({ params }) {
  const album = await albumParSlug(params.slug, params.album);
  if (!album) return { title: "Album introuvable" };

  const description =
    album.description || `${album.title}, ${album.titres} titre(s) de ${album.artist_name}.`;
  const image = album.cover_url ? `${SITE_URL}${album.cover_url}` : `${SITE_URL}/icone-512.png`;

  return {
    title: `${album.title} — ${album.artist_name}`,
    description,
    alternates: { canonical: `${SITE_URL}/artistes/${album.artist_slug}/${album.slug}` },
    openGraph: {
      type: "music.album",
      title: `${album.title} — ${album.artist_name}`,
      description,
      images: [{ url: image }],
    },
  };
}

export default async function AlbumPage({ params }) {
  const album = await albumParSlug(params.slug, params.album);
  if (!album || !album.published) notFound();

  const titres = await titresAlbum(album.id);

  const donneesStructurees = {
    "@context": "https://schema.org",
    "@type": "MusicAlbum",
    name: album.title,
    url: `${SITE_URL}/artistes/${album.artist_slug}/${album.slug}`,
    numTracks: album.titres,
    description: album.description || undefined,
    datePublished: album.released_on || undefined,
    byArtist: {
      "@type": "MusicGroup",
      name: album.artist_name,
      url: `${SITE_URL}/artistes/${album.artist_slug}`,
    },
    track: titres.map((titre, rang) => ({
      "@type": "MusicRecording",
      position: rang + 1,
      name: titre.title,
      url: `${SITE_URL}/titre/${titre.id}`,
    })),
  };

  return (
    <div className="flex flex-col gap-8">
      <DonneesStructurees donnees={donneesStructurees} />

      <header className="flex flex-col gap-5 rounded-2xl border border-faso-line bg-gradient-to-br from-faso-panel to-black p-6 sm:flex-row">
        <div className="mx-auto h-48 w-48 shrink-0 overflow-hidden rounded-xl border border-faso-line sm:mx-0">
          <Cover src={album.cover_url} alt={album.title} rounded="rounded-xl" />
        </div>

        <div className="min-w-0 flex-1 text-center sm:text-left">
          <p className="text-xs font-semibold uppercase tracking-widest text-faso-gold">
            {LIBELLES[album.kind] || "Album"}
          </p>
          <h1 className="mt-1 text-2xl font-black text-white sm:text-3xl">{album.title}</h1>
          <Link
            href={`/artistes/${album.artist_slug}`}
            className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-white/70 hover:text-white"
          >
            {album.artist_name}
            <HiCheckBadge className="text-faso-gold" />
          </Link>

          <div className="mt-3 flex flex-wrap justify-center gap-2 sm:justify-start">
            <span className="chip">{album.titres} titre(s)</span>
            <span className="chip">{formatDuration(album.duree)}</span>
            {album.released_on && <span className="chip">Sorti le {album.released_on}</span>}
          </div>

          {album.description && (
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-white/65">
              {album.description}
            </p>
          )}
        </div>
      </header>

      <TrackList tracks={titres} empty={`Aucun titre publie dans cet album sur ${SITE_NAME}.`} />
    </div>
  );
}
