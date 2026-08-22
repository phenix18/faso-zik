import Link from "next/link";
import { currentUser } from "@/lib/auth";
import { findUserById } from "@/lib/repo/users";
import { getArtistByUserId } from "@/lib/repo/artists";
import { listTracks } from "@/lib/repo/tracks";
import CompteClient from "@/components/compte/CompteClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Mon compte", robots: { index: false } };

export default async function ComptePage() {
  const user = await currentUser();

  if (!user) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-center">
        <h1 className="section-title">Mon compte</h1>
        <Link href="/connexion?callbackUrl=/compte" className="btn-primary">
          Se connecter
        </Link>
      </div>
    );
  }

  const compte = await findUserById(user.id);
  const artiste = await getArtistByUserId(user.id);

  return (
    <CompteClient
      compte={{ name: compte.name, email: compte.email, role: compte.role }}
      artiste={artiste ? { nom: artiste.name, slug: artiste.slug } : null}
      titres={artiste ? await listTracks({ artistId: artiste.id, includeUnpublished: true }).length : 0}
    />
  );
}
