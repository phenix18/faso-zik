import { listTracks } from "@/lib/repo/tracks";
import TrackGrid from "@/components/TrackGrid";

export const dynamic = "force-dynamic";
export const metadata = { title: "Clips video" };

export default async function ClipsPage() {
  const clips = await listTracks({ kind: "video", limit: 120 });

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="section-title">Clips video</h1>
        <p className="text-xs text-white/40">
          Les clips se lisent dans le lecteur du site ; touchez la pochette du lecteur pour passer
          en plein ecran.
        </p>
      </div>
      <TrackGrid tracks={clips} empty="Aucun clip publie pour l'instant." />
    </div>
  );
}
