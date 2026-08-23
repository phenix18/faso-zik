import { execute, query, unique } from "@/lib/db";
import { newId } from "@/lib/ids";
import { toPublicTrack } from "@/lib/repo/tracks";

const JOINED = `
  SELECT t.*, a.name AS artist_name, a.slug AS artist_slug,
         a.photo_url AS artist_photo, a.verified AS artist_verified,
         al.title AS album_title, al.slug AS album_slug, al.cover_url AS album_cover
    FROM tracks t
    JOIN artists a ON a.id = t.artist_id
    LEFT JOIN albums al ON al.id = t.album_id
`;

/* ------------------------------- favoris -------------------------------- */

export async function listFavourites(userId) {
  const lignes = await query(
    `${JOINED} JOIN favourites f ON f.track_id = t.id
      WHERE f.user_id = $1 ORDER BY f.created_at DESC`,
    [userId],
  );
  return lignes.map(toPublicTrack);
}

export async function isFavourite(userId, trackId) {
  return !!(await unique("SELECT 1 FROM favourites WHERE user_id = $1 AND track_id = $2", [
    userId,
    trackId,
  ]));
}

export async function toggleFavourite(userId, trackId) {
  if (await isFavourite(userId, trackId)) {
    await execute("DELETE FROM favourites WHERE user_id = $1 AND track_id = $2", [userId, trackId]);
    return false;
  }
  await execute("INSERT INTO favourites (user_id, track_id) VALUES ($1, $2)", [userId, trackId]);
  return true;
}

/* ------------------------------ playlists ------------------------------- */

export async function listPlaylists(userId) {
  return query(
    `SELECT p.*,
            (SELECT COUNT(*)::int FROM playlist_tracks pt WHERE pt.playlist_id = p.id) AS track_count
       FROM playlists p WHERE p.user_id = $1 ORDER BY p.created_at DESC`,
    [userId],
  );
}

export async function createPlaylist(userId, name, isPublic = false) {
  const id = newId("pl");
  await execute("INSERT INTO playlists (id, user_id, name, is_public) VALUES ($1, $2, $3, $4)", [
    id,
    userId,
    name,
    !!isPublic,
  ]);
  return getPlaylist(id);
}

export async function getPlaylist(id) {
  const playlist = await unique("SELECT * FROM playlists WHERE id = $1", [id]);
  if (!playlist) return null;

  const lignes = await query(
    `${JOINED} JOIN playlist_tracks pt ON pt.track_id = t.id
      WHERE pt.playlist_id = $1 ORDER BY pt.position ASC`,
    [id],
  );

  return { ...playlist, isPublic: !!playlist.is_public, tracks: lignes.map(toPublicTrack) };
}

export async function addToPlaylist(playlistId, trackId) {
  const { n } = await unique(
    "SELECT COUNT(*)::int AS n FROM playlist_tracks WHERE playlist_id = $1",
    [playlistId],
  );
  await execute(
    `INSERT INTO playlist_tracks (playlist_id, track_id, position) VALUES ($1, $2, $3)
     ON CONFLICT DO NOTHING`,
    [playlistId, trackId, n],
  );
  return getPlaylist(playlistId);
}

export async function removeFromPlaylist(playlistId, trackId) {
  await execute("DELETE FROM playlist_tracks WHERE playlist_id = $1 AND track_id = $2", [
    playlistId,
    trackId,
  ]);
  return getPlaylist(playlistId);
}

export async function deletePlaylist(playlistId) {
  await execute("DELETE FROM playlists WHERE id = $1", [playlistId]);
}
