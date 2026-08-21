import Link from "next/link";
import { currentUser } from "@/lib/auth";
import { listFavourites } from "@/lib/repo/library";
import TrackList from "@/components/TrackList";

export const dynamic = "force-dynamic";
export const metadata = { title: "Mes favoris" };

export default async function FavorisPage() {
  const user = await currentUser();

  if (!user) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-center">
        <h1 className="section-title">Mes favoris</h1>
        <p className="text-sm text-white/45">Connectez-vous pour retrouver vos titres favoris.</p>
        <Link href="/connexion?callbackUrl=/favoris" className="btn-primary">
          Se connecter
        </Link>
      </div>
    );
  }

  const tracks = listFavourites(user.id);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="section-title">Mes favoris</h1>
        <p className="text-xs text-white/40">{tracks.length} titre(s) enregistre(s)</p>
      </div>
      <TrackList
        tracks={tracks}
        empty="Aucun favori pour l'instant. Touchez le coeur sur un titre pour l'ajouter ici."
      />
    </div>
  );
}
