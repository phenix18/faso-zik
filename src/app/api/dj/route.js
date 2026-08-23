import { query } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { toPublicTrack } from "@/lib/repo/tracks";
import { fail, json } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Bac a disques de la platine : uniquement les titres dont l'artiste a
 * autorise l'usage en mix.
 */
export async function GET(request) {
  // Meme regle que la page : la platine se tient avec un compte.
  const user = await currentUser();
  if (!user) return fail("Connectez-vous pour ouvrir la platine.", 401);

  const recherche = new URL(request.url).searchParams.get("q") || "";
  const terme = recherche.trim();

  const rows = await query(
    `SELECT t.*, a.name AS artist_name, a.slug AS artist_slug,
            a.photo_url AS artist_photo, a.verified AS artist_verified,
            al.title AS album_title, al.slug AS album_slug, al.cover_url AS album_cover
       FROM tracks t
       JOIN artists a ON a.id = t.artist_id
       LEFT JOIN albums al ON al.id = t.album_id
      WHERE t.published AND t.allow_stream AND t.allow_dj AND t.kind = 'audio'
        AND ($1 = '' OR t.title ILIKE $2 OR a.name ILIKE $2 OR t.genre ILIKE $2)
      ORDER BY t.plays DESC, t.created_at DESC
      LIMIT 120`,
    [terme, `%${terme}%`],
  );

  return json({ tracks: rows.map(toPublicTrack), total: rows.length });
}
