import { query } from "@/lib/db";
import { toPublicTrack } from "@/lib/repo/tracks";
import DjConsole from "@/components/dj/DjConsole";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Platine DJ",
  description:
    "Mixez le catalogue FASO-ZIK dans le navigateur : deux platines, crossfader, egaliseur et boucles, sur les titres ouverts au mix par leurs artistes.",
};

export default async function DjPage() {
  // La platine est libre d'acces, comme l'ecoute : elle ne sert que des titres
  // dont l'artiste a explicitement ouvert l'usage en mix. Le tri est fait par
  // la requete, pas par un compte.
  const rows = await query(
    `SELECT t.*, a.name AS artist_name, a.slug AS artist_slug,
            a.photo_url AS artist_photo, a.verified AS artist_verified,
            al.title AS album_title, al.slug AS album_slug, al.cover_url AS album_cover
       FROM tracks t
       JOIN artists a ON a.id = t.artist_id
       LEFT JOIN albums al ON al.id = t.album_id
      WHERE t.published AND t.allow_stream AND t.allow_dj AND t.kind = 'audio'
      ORDER BY t.plays DESC, t.created_at DESC
      LIMIT 200`,
  );

  return <DjConsole tracks={rows.map(toPublicTrack)} />;
}
