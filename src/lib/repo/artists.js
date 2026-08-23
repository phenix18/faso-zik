import { execute, query, unique } from "@/lib/db";

export async function getArtistByUserId(userId) {
  if (!userId) return null;
  return unique("SELECT * FROM artists WHERE user_id = $1", [userId]);
}

export async function getArtistBySlug(slug) {
  return unique("SELECT * FROM artists WHERE slug = $1", [slug]);
}

export async function getArtistById(id) {
  if (!id) return null;
  return unique("SELECT * FROM artists WHERE id = $1", [id]);
}

export async function listArtists({ limit = 60, search = "" } = {}) {
  const terme = search.trim();
  const like = `%${terme}%`;

  return query(
    `SELECT a.*,
            (SELECT COUNT(*)::int FROM tracks t WHERE t.artist_id = a.id AND t.published) AS track_count,
            (SELECT COALESCE(SUM(t.plays), 0)::int FROM tracks t WHERE t.artist_id = a.id) AS total_plays
       FROM artists a
      WHERE ($1 = '' OR a.name ILIKE $2 OR a.city ILIKE $2 OR a.genres ILIKE $2)
      ORDER BY total_plays DESC, a.name ASC
      LIMIT $3`,
    [terme, like, limit],
  );
}

export async function updateArtist(artistId, fields) {
  const allowed = ["name", "bio", "city", "country", "genres", "photo_url"];
  const entries = Object.entries(fields).filter(
    ([key, value]) => allowed.includes(key) && value !== undefined,
  );
  if (!entries.length) return getArtistById(artistId);

  const setSql = entries.map(([key], index) => `${key} = $${index + 1}`).join(", ");
  await execute(`UPDATE artists SET ${setSql} WHERE id = $${entries.length + 1}`, [
    ...entries.map(([, value]) => value),
    artistId,
  ]);
  return getArtistById(artistId);
}

export async function artistStats(artistId) {
  return unique(
    `SELECT COUNT(*)::int                                                  AS tracks,
            COALESCE(SUM(plays), 0)::int                                   AS plays,
            COALESCE(SUM(downloads), 0)::int                               AS downloads,
            COUNT(*) FILTER (WHERE kind = 'video')::int                    AS videos,
            COUNT(*) FILTER (WHERE allow_download)::int                    AS downloadable,
            COUNT(*) FILTER (WHERE allow_dj)::int                          AS dj_ready
       FROM tracks WHERE artist_id = $1`,
    [artistId],
  );
}
