import { getDb } from "@/lib/db";
import { newId } from "@/lib/ids";
import { toPublicTrack } from "@/lib/repo/tracks";

const JOINED = `
  SELECT t.*, a.name AS artist_name, a.slug AS artist_slug,
         a.photo_url AS artist_photo, a.verified AS artist_verified
    FROM tracks t JOIN artists a ON a.id = t.artist_id
`;

/* ------------------------------- favoris -------------------------------- */

export function listFavourites(userId) {
  return getDb()
    .prepare(
      `${JOINED} JOIN favourites f ON f.track_id = t.id
        WHERE f.user_id = ? ORDER BY f.created_at DESC`,
    )
    .all(userId)
    .map(toPublicTrack);
}

export function isFavourite(userId, trackId) {
  return !!getDb()
    .prepare("SELECT 1 FROM favourites WHERE user_id = ? AND track_id = ?")
    .get(userId, trackId);
}

export function toggleFavourite(userId, trackId) {
  const db = getDb();
  if (isFavourite(userId, trackId)) {
    db.prepare("DELETE FROM favourites WHERE user_id = ? AND track_id = ?").run(userId, trackId);
    return false;
  }
  db.prepare("INSERT INTO favourites (user_id, track_id) VALUES (?, ?)").run(userId, trackId);
  return true;
}

/* ------------------------------ playlists ------------------------------- */

export function listPlaylists(userId) {
  return getDb()
    .prepare(
      `SELECT p.*, (SELECT COUNT(*) FROM playlist_tracks pt WHERE pt.playlist_id = p.id) AS track_count
         FROM playlists p WHERE p.user_id = ? ORDER BY p.created_at DESC`,
    )
    .all(userId);
}

export function createPlaylist(userId, name, isPublic = false) {
  const id = newId("pl");
  getDb()
    .prepare("INSERT INTO playlists (id, user_id, name, is_public) VALUES (?, ?, ?, ?)")
    .run(id, userId, name, isPublic ? 1 : 0);
  return getPlaylist(id);
}

export function getPlaylist(id) {
  const db = getDb();
  const playlist = db.prepare("SELECT * FROM playlists WHERE id = ?").get(id);
  if (!playlist) return null;
  const tracks = db
    .prepare(
      `${JOINED} JOIN playlist_tracks pt ON pt.track_id = t.id
        WHERE pt.playlist_id = ? ORDER BY pt.position ASC`,
    )
    .all(id)
    .map(toPublicTrack);
  return { ...playlist, isPublic: !!playlist.is_public, tracks };
}

export function addToPlaylist(playlistId, trackId) {
  const db = getDb();
  const { n } = db
    .prepare("SELECT COUNT(*) AS n FROM playlist_tracks WHERE playlist_id = ?")
    .get(playlistId);
  db.prepare(
    `INSERT OR IGNORE INTO playlist_tracks (playlist_id, track_id, position) VALUES (?, ?, ?)`,
  ).run(playlistId, trackId, n);
  return getPlaylist(playlistId);
}

export function removeFromPlaylist(playlistId, trackId) {
  getDb()
    .prepare("DELETE FROM playlist_tracks WHERE playlist_id = ? AND track_id = ?")
    .run(playlistId, trackId);
  return getPlaylist(playlistId);
}

export function deletePlaylist(playlistId) {
  getDb().prepare("DELETE FROM playlists WHERE id = ?").run(playlistId);
}
