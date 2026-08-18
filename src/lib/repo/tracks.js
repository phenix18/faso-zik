import { getDb } from "@/lib/db";
import { newId, slugify } from "@/lib/ids";

const SELECT_TRACK = `
  SELECT t.*,
         a.name  AS artist_name,
         a.slug  AS artist_slug,
         a.photo_url AS artist_photo,
         a.verified  AS artist_verified
    FROM tracks t
    JOIN artists a ON a.id = t.artist_id
`;

/** Forme envoyee au navigateur : jamais le chemin disque du fichier source. */
export function toPublicTrack(row) {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    kind: row.kind,
    genre: row.genre,
    language: row.language,
    description: row.description,
    duration: row.duration,
    bpm: row.bpm,
    musicKey: row.music_key,
    coverUrl: row.cover_url,
    mime: row.media_mime,
    size: row.media_size,
    license: row.license,
    published: !!row.published,
    plays: row.plays,
    downloads: row.downloads,
    createdAt: row.created_at,
    permissions: {
      stream: !!row.allow_stream,
      download: !!row.allow_download,
      dj: !!row.allow_dj,
    },
    artist: {
      id: row.artist_id,
      name: row.artist_name,
      slug: row.artist_slug,
      photoUrl: row.artist_photo,
      verified: !!row.artist_verified,
    },
    streamUrl: `/api/stream/${row.id}`,
    downloadUrl: row.allow_download ? `/api/download/${row.id}` : null,
  };
}

export function getTrackRow(id) {
  return getDb().prepare(`${SELECT_TRACK} WHERE t.id = ?`).get(id);
}

export function getTrack(id) {
  return toPublicTrack(getTrackRow(id));
}

export function listTracks({
  kind,
  artistId,
  artistSlug,
  genre,
  search = "",
  sort = "recent",
  limit = 60,
  offset = 0,
  includeUnpublished = false,
} = {}) {
  const where = [];
  const params = [];

  if (!includeUnpublished) where.push("t.published = 1");
  if (kind) {
    where.push("t.kind = ?");
    params.push(kind);
  }
  if (artistId) {
    where.push("t.artist_id = ?");
    params.push(artistId);
  }
  if (artistSlug) {
    where.push("a.slug = ?");
    params.push(artistSlug);
  }
  if (genre) {
    where.push("LOWER(t.genre) = LOWER(?)");
    params.push(genre);
  }
  if (search.trim()) {
    where.push("(t.title LIKE ? OR a.name LIKE ? OR t.genre LIKE ? OR t.language LIKE ?)");
    const like = `%${search.trim()}%`;
    params.push(like, like, like, like);
  }

  const order =
    { populaire: "t.plays DESC, t.created_at DESC", titre: "t.title ASC" }[sort] ||
    "t.created_at DESC";

  const sql = `${SELECT_TRACK}
    ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
    ORDER BY ${order}
    LIMIT ? OFFSET ?`;

  return getDb()
    .prepare(sql)
    .all(...params, limit, offset)
    .map(toPublicTrack);
}

export function listGenres() {
  return getDb()
    .prepare(
      `SELECT genre, COUNT(*) AS n
         FROM tracks WHERE published = 1 AND genre IS NOT NULL AND genre <> ''
        GROUP BY genre ORDER BY n DESC LIMIT 24`,
    )
    .all();
}

export function uniqueTrackSlug(artistId, title) {
  const db = getDb();
  const base = slugify(title);
  let slug = base;
  let n = 2;
  while (
    db.prepare("SELECT 1 FROM tracks WHERE artist_id = ? AND slug = ?").get(artistId, slug)
  ) {
    slug = `${base}-${n++}`;
  }
  return slug;
}

export function createTrack(data) {
  const db = getDb();
  const id = newId("trk");
  db.prepare(
    `INSERT INTO tracks (
        id, artist_id, title, slug, kind, genre, language, description,
        duration, bpm, music_key, cover_url, media_path, media_mime, media_size,
        allow_stream, allow_download, allow_dj, license, published
     ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
  ).run(
    id,
    data.artistId,
    data.title,
    uniqueTrackSlug(data.artistId, data.title),
    data.kind,
    data.genre || null,
    data.language || null,
    data.description || null,
    data.duration || 0,
    data.bpm || null,
    data.musicKey || null,
    data.coverUrl || null,
    data.mediaPath,
    data.mediaMime,
    data.mediaSize,
    data.allowStream === false ? 0 : 1,
    data.allowDownload ? 1 : 0,
    data.allowDj ? 1 : 0,
    data.license || "Tous droits reserves",
    data.published === false ? 0 : 1,
  );
  return getTrack(id);
}

/**
 * Mise a jour reservee au proprietaire du morceau (verifie par l'appelant).
 * Ce sont notamment les autorisations que l'artiste accorde ou retire.
 */
export function updateTrack(id, fields) {
  const map = {
    title: "title",
    genre: "genre",
    language: "language",
    description: "description",
    bpm: "bpm",
    musicKey: "music_key",
    coverUrl: "cover_url",
    license: "license",
    allowStream: "allow_stream",
    allowDownload: "allow_download",
    allowDj: "allow_dj",
    published: "published",
  };
  const booleans = new Set(["allowStream", "allowDownload", "allowDj", "published"]);

  const entries = Object.entries(fields).filter(
    ([key, value]) => map[key] && value !== undefined,
  );
  if (!entries.length) return getTrack(id);

  const setSql = entries.map(([key]) => `${map[key]} = ?`).join(", ");
  const values = entries.map(([key, value]) => (booleans.has(key) ? (value ? 1 : 0) : value));
  getDb().prepare(`UPDATE tracks SET ${setSql} WHERE id = ?`).run(...values, id);
  return getTrack(id);
}

export function deleteTrack(id) {
  getDb().prepare("DELETE FROM tracks WHERE id = ?").run(id);
}

export function recordEvent(trackId, type, userId = null) {
  const db = getDb();
  db.prepare("INSERT INTO events (track_id, user_id, type) VALUES (?, ?, ?)").run(
    trackId,
    userId,
    type,
  );
  if (type === "play") {
    db.prepare("UPDATE tracks SET plays = plays + 1 WHERE id = ?").run(trackId);
  } else if (type === "download") {
    db.prepare("UPDATE tracks SET downloads = downloads + 1 WHERE id = ?").run(trackId);
  }
}
