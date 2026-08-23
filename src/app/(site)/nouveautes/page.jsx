import Link from "next/link";
import { currentUser } from "@/lib/auth";
import { artistesSuivis, nouveautesSuivies } from "@/lib/repo/social";
import TrackList from "@/components/TrackList";
import ArtistCard from "@/components/ArtistCard";
import SectionHeader from "@/components/SectionHeader";

export const dynamic = "force-dynamic";
export const metadata = { title: "Nouveautes de mes artistes" };

export default async function NouveautesPage() {
  const user = await currentUser();

  if (!user) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-center">
        <h1 className="section-title">Nouveautes de mes artistes</h1>
        <p className="max-w-md text-sm text-white/45">
          Abonnez-vous a vos artistes depuis leur page pour retrouver ici leurs sorties.
        </p>
        <Link href="/connexion?callbackUrl=/nouveautes" className="btn-primary">
          Se connecter
        </Link>
      </div>
    );
  }

  const artistes = await artistesSuivis(user.id);
  const titres = await nouveautesSuivies(user.id);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="section-title">Nouveautes de mes artistes</h1>
        <p className="text-xs text-white/40">{artistes.length} artiste(s) suivi(s)</p>
      </div>

      <TrackList
        tracks={titres}
        empty="Aucune sortie pour l'instant. Abonnez-vous a un artiste depuis sa page."
      />

      {artistes.length > 0 && (
        <section>
          <SectionHeader title="Artistes suivis" />
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
            {artistes.map((artiste) => (
              <ArtistCard key={artiste.id} artist={artiste} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
