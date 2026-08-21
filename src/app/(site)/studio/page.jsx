import Link from "next/link";
import { currentUser } from "@/lib/auth";
import { artistStats, getArtistByUserId } from "@/lib/repo/artists";
import { listTracks } from "@/lib/repo/tracks";
import { paiementsArtiste, revenusArtiste } from "@/lib/repo/payments";
import { albumsArtiste } from "@/lib/repo/albums";
import StudioClient from "@/components/studio/StudioClient";
import OpenArtistSpace from "@/components/studio/OpenArtistSpace";

export const dynamic = "force-dynamic";
export const metadata = { title: "Studio artiste" };

export default async function StudioPage() {
  const user = await currentUser();

  if (!user) {
    return (
      <div className="flex min-h-[55vh] flex-col items-center justify-center gap-3 text-center">
        <h1 className="section-title">Studio artiste</h1>
        <p className="max-w-md text-sm text-white/45">
          Deposez vos titres et vos clips, et decidez vous-meme de ce qui peut etre telecharge ou
          mixe. Connectez-vous pour continuer.
        </p>
        <div className="flex gap-3">
          <Link href="/connexion?callbackUrl=/studio" className="btn-primary">
            Se connecter
          </Link>
          <Link href="/inscription" className="btn-ghost">
            Creer un compte artiste
          </Link>
        </div>
      </div>
    );
  }

  const artist = getArtistByUserId(user.id);
  if (!artist) return <OpenArtistSpace defaultName={user.name} />;

  return (
    <StudioClient
      artist={artist}
      initialTracks={listTracks({ artistId: artist.id, includeUnpublished: true, limit: 200 })}
      stats={artistStats(artist.id)}
      revenus={revenusArtiste(artist.id)}
      paiements={paiementsArtiste(artist.id, 30)}
      albums={albumsArtiste(artist.id)}
    />
  );
}
