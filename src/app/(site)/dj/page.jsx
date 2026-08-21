import { getDb } from "@/lib/db";
import { toPublicTrack } from "@/lib/repo/tracks";
import DjConsole from "@/components/dj/DjConsole";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Platine DJ",
  description:
    "Mixez le catalogue FASO-ZIK dans le navigateur : deux platines, crossfader, egaliseur et boucles, sur les titres ouverts au mix par leurs artistes.",
};

export default function DjPage() {
  const rows = getDb()
    .prepare(
      `SELECT t.*, a.name AS artist_name, a.slug AS artist_slug,
              a.photo_url AS artist_photo, a.verified AS artist_verified
         FROM tracks t JOIN artists a ON a.id = t.artist_id
        WHERE t.published = 1 AND t.allow_stream = 1 AND t.allow_dj = 1 AND t.kind = 'audio'
        ORDER BY t.plays DESC, t.created_at DESC
        LIMIT 200`,
    )
    .all();

  return <DjConsole tracks={rows.map(toPublicTrack)} />;
}
