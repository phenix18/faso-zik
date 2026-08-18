import { getDb } from "@/lib/db";
import { toPublicTrack } from "@/lib/repo/tracks";
import { json } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Bac a disques de la platine : uniquement les titres dont l'artiste a
 * autorise l'usage en mix (allow_dj).
 */
export async function GET(request) {
  const search = new URL(request.url).searchParams.get("q") || "";
  const like = `%${search.trim()}%`;

  const rows = getDb()
    .prepare(
      `SELECT t.*, a.name AS artist_name, a.slug AS artist_slug,
              a.photo_url AS artist_photo, a.verified AS artist_verified
         FROM tracks t JOIN artists a ON a.id = t.artist_id
        WHERE t.published = 1 AND t.allow_stream = 1 AND t.allow_dj = 1
          AND t.kind = 'audio'
          AND (? = '' OR t.title LIKE ? OR a.name LIKE ? OR t.genre LIKE ?)
        ORDER BY t.plays DESC, t.created_at DESC
        LIMIT 120`,
    )
    .all(search.trim(), like, like, like);

  return json({ tracks: rows.map(toPublicTrack), total: rows.length });
}
