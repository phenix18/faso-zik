import { classementSemaine } from "@/lib/repo/social";
import TrackList from "@/components/TrackList";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Classement de la semaine",
  description: "Les titres les plus ecoutes des sept derniers jours sur FASO-ZIK.",
};

export default async function ClassementPage() {
  const titres = await classementSemaine(30);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="section-title">Classement de la semaine</h1>
        <p className="text-xs text-white/40">
          Etabli sur les ecoutes des sept derniers jours, pas sur le total cumule : les anciens
          succes ne bloquent pas la tete du classement.
        </p>
      </div>
      <TrackList
        tracks={titres}
        empty="Pas encore assez d'ecoutes cette semaine pour etablir un classement."
      />
    </div>
  );
}
