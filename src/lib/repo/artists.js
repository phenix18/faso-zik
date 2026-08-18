import { getDb } from "@/lib/db";

export function getArtistByUserId(userId) {
  return getDb().prepare("SELECT * FROM artists WHERE user_id = ?").get(userId);
}

export function getArtistBySlug(slug) {
  return getDb().prepare("SELECT * FROM artists WHERE slug = ?").get(slug);
}

export function getArtistById(id) {
  return getDb().prepare("SELECT * FROM artists WHERE id = ?").get(id);
}

export function listArtists({ limit = 60, search = "" } = {}) {
  const db = getDb();
  const like = `%${search.trim()}%`;
  return db
    .prepare(
      `SELECT a.*,
              (SELECT COUNT(*) FROM tracks t WHERE t.artist_id = a.id AND t.published = 1) AS track_count,
              (SELECT COALESCE(SUM(t.plays), 0) FROM tracks t WHERE t.artist_id = a.id) AS total_plays
         FROM artists a
        WHERE (? = '' OR a.name LIKE ? OR a.city LIKE ? OR a.genres LIKE ?)
        ORDER BY total_plays DESC, a.name ASC
        LIMIT ?`,
    )
    .all(search.trim(), like, like, like, limit);
}

export function updateArtist(artistId, fields) {
  const allowed = ["name", "bio", "city", "country", "genres", "photo_url"];
  const entries = Object.entries(fields).filter(
    ([key, value]) => allowed.includes(key) && value !== undefined,
  );
  if (!entries.length) return getArtistById(artistId);

  const setSql = entries.map(([key]) => `${key} = ?`).join(", ");
  getDb()
    .prepare(`UPDATE artists SET ${setSql} WHERE id = ?`)
    .run(...entries.map(([, value]) => value), artistId);
  return getArtistById(artistId);
}

export function artistStats(artistId) {
  const db = getDb();
  return db
    .prepare(
      `SELECT COUNT(*)                                   AS tracks,
              COALESCE(SUM(plays), 0)                    AS plays,
              COALESCE(SUM(downloads), 0)                AS downloads,
              COALESCE(SUM(kind = 'video'), 0)           AS videos,
              COALESCE(SUM(allow_download), 0)           AS downloadable,
              COALESCE(SUM(allow_dj), 0)                 AS dj_ready
         FROM tracks WHERE artist_id = ?`,
    )
    .get(artistId);
}
