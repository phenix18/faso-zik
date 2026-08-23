import { redirect } from "next/navigation";
import { query } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { toPublicTrack } from "@/lib/repo/tracks";
import DjConsole from "@/components/dj/DjConsole";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Platine DJ",
  description:
    "Mixez le catalogue FASO-ZIK dans le navigateur : deux platines, crossfader, egaliseur et boucles, sur les titres ouverts au mix par leurs artistes.",
};

export default async function DjPage() {
  // La platine charge les morceaux entiers en memoire pour pouvoir sauter,
  // boucler et tracer la forme d'onde. C'est un usage bien plus lourd que
  // l'ecoute, et un usage professionnel : il se fait avec un compte.
  const user = await currentUser();
  if (!user) redirect("/connexion?callbackUrl=/dj");

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
