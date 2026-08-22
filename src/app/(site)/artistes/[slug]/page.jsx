import Link from "next/link";
import { notFound } from "next/navigation";
import { HiCheckBadge } from "react-icons/hi2";
import { artistStats, getArtistBySlug } from "@/lib/repo/artists";
import { listTracks } from "@/lib/repo/tracks";
import TrackList from "@/components/TrackList";
import TrackGrid from "@/components/TrackGrid";
import SectionHeader from "@/components/SectionHeader";
import SoutenirArtiste from "@/components/SoutenirArtiste";
import BoutonAbonnement from "@/components/BoutonAbonnement";
import { currentUser } from "@/lib/auth";
import { nombreAbonnes, suit } from "@/lib/repo/social";
import { albumsArtiste } from "@/lib/repo/albums";
import Cover from "@/components/Cover";
import DonneesStructurees from "@/components/DonneesStructurees";
import { SITE_NAME, SITE_URL } from "@/lib/siteConfig";
import { formatCount } from "@/lib/format";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }) {
  const artist = await getArtistBySlug(params.slug);
  if (!artist) return { title: "Artiste introuvable" };

  const description =
    artist.bio ||
    `Ecoutez ${artist.name}${artist.city ? `, ${artist.city}` : ""} sur ${SITE_NAME}.`;
  const image = artist.photo_url ? `${SITE_URL}${artist.photo_url}` : `${SITE_URL}/icone-512.png`;

  return {
    title: artist.name,
    description,
    alternates: { canonical: `${SITE_URL}/artistes/${artist.slug}` },
    openGraph: {
      type: "profile",
      title: artist.name,
      description,
      url: `${SITE_URL}/artistes/${artist.slug}`,
      images: [{ url: image }],
    },
    twitter: { card: "summary_large_image", title: artist.name, description, images: [image] },
  };
}

export default async function ArtistPage({ params }) {
  const artist = await getArtistBySlug(params.slug);
  if (!artist) notFound();

  const user = await currentUser();

  const tracks = await listTracks({ artistId: artist.id, limit: 200 });
  const albums = (await albumsArtiste(artist.id, { inclureVides: false })).filter(
    (album) => album.published,
  );
  // Les titres deja ranges dans un album sont presentes avec lui.
  const audios = tracks.filter((track) => track.kind === "audio" && !track.album);
  const videos = tracks.filter((track) => track.kind === "video");
  const stats = await artistStats(artist.id);

  const donneesStructurees = {
    "@context": "https://schema.org",
    "@type": "MusicGroup",
    name: artist.name,
    url: `${SITE_URL}/artistes/${artist.slug}`,
    description: artist.bio || undefined,
    genre: artist.genres || undefined,
    ...(artist.photo_url ? { image: `${SITE_URL}${artist.photo_url}` } : {}),
    ...(artist.city
      ? { foundingLocation: { "@type": "Place", name: `${artist.city}, ${artist.country || ""}`.trim() } }
      : {}),
    track: audios.slice(0, 10).map((titre) => ({
      "@type": "MusicRecording",
      name: titre.title,
      url: `${SITE_URL}/titre/${titre.id}`,
    })),
  };

  return (
    <div className="flex flex-col gap-8">
      <DonneesStructurees donnees={donneesStructurees} />
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
          <div className="mt-4 flex flex-wrap items-center justify-center gap-3 sm:justify-start">
            <BoutonAbonnement
              artistId={artist.id}
              initial={await suit(user?.id, artist.id)}
              abonnes={await nombreAbonnes(artist.id)}
            />
          </div>
          <SoutenirArtiste artist={{ id: artist.id, name: artist.name }} />
        </div>
      </header>

      {albums.length > 0 && (
        <section>
          <SectionHeader title="Albums et EP" />
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
            {albums.map((album) => (
              <Link key={album.id} href={`/artistes/${artist.slug}/${album.slug}`} className="group">
                <span className="block aspect-square overflow-hidden rounded-xl border border-faso-line">
                  <Cover src={album.cover_url} alt={album.title} rounded="rounded-xl" />
                </span>
                <span className="mt-2 block truncate text-sm font-semibold text-white group-hover:text-faso-gold">
                  {album.title}
                </span>
                <span className="block text-xs text-white/40">{album.titres} titre(s)</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {audios.length > 0 && (
        <section>
          <SectionHeader title={albums.length > 0 ? "Autres titres" : "Titres"} />
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
