import { getDb } from "@/lib/db";
import { newId, slugify } from "@/lib/ids";

const SELECT_TRACK = `
  SELECT t.*,
         a.name  AS artist_name,
         a.slug  AS artist_slug,
         a.photo_url AS artist_photo,
         a.verified  AS artist_verified,
         al.title AS album_title,
         al.slug  AS album_slug,
         al.cover_url AS album_cover
    FROM tracks t
    JOIN artists a ON a.id = t.artist_id
    LEFT JOIN albums al ON al.id = t.album_id
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
    // A defaut de pochette propre, celle de l'album : un titre isole dans une
    // liste d'album ne doit pas jurer avec ses voisins.
    coverUrl: row.cover_url || row.album_cover || null,
    album: row.album_id
      ? { id: row.album_id, title: row.album_title, slug: row.album_slug, trackNo: row.track_no }
      : null,
    mime: row.media_mime,
    size: row.media_size,
    license: row.license,
    // Prix du telechargement en francs CFA ; zero = gratuit si l'artiste
    // l'autorise.
    priceCfa: row.price_cfa || 0,
    rightsConfirmed: !!row.rights_confirmed,
    published: !!row.published,
    // "absent" : rien a faire ou ffmpeg indisponible ; "attente" / "encours" :
    // en cours de fabrication ; "pret" : version allegee servie ; "echec".
    transcodeStatus: row.transcode_status || "absent",
    hasPreview: !!row.preview_path,
    // Taille reellement transferee a l'ecoute, celle qui compte pour
    // l'auditeur en donnees mobiles.
    streamSize: row.preview_size || row.media_size,
    plays: row.plays,
    downloads: row.downloads,
    createdAt: row.created_at,
    permissions: {
      stream: !!row.allow_stream,
      download: !!row.allow_download,
      dj: !!row.allow_dj,
      // L'artiste autorise le telechargement, mais contre paiement.
      downloadPaid: !!row.allow_download && (row.price_cfa || 0) > 0,
    },
    artist: {
      id: row.artist_id,
      name: row.artist_name,
      slug: row.artist_slug,
      photoUrl: row.artist_photo,
      verified: !!row.artist_verified,
    },
    streamUrl: `/api/stream/${row.id}`,
    // Present seulement pour un clip decoupe : le lecteur le prefere alors au
    // fichier complet.
    hlsUrl: row.hls_path ? `/api/hls/${row.id}/master.m3u8` : null,
    // Le lien n'apparait que pour un telechargement gratuit ; un titre payant
    // passe d'abord par la page de paiement.
    downloadUrl: row.allow_download && !(row.price_cfa || 0) ? `/api/download/${row.id}` : null,
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
  albumId,
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
  if (albumId) {
    where.push("t.album_id = ?");
    params.push(albumId);
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
        allow_stream, allow_download, allow_dj, license, rights_confirmed, published,
        price_cfa, album_id, track_no
     ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
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
    data.rightsConfirmed ? 1 : 0,
    data.published === false ? 0 : 1,
    Math.max(0, Math.round(Number(data.priceCfa) || 0)),
    data.albumId || null,
    data.trackNo || null,
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
    priceCfa: "price_cfa",
    albumId: "album_id",
    trackNo: "track_no",
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

/** Enregistre le resultat du transcodage lance apres le depot. */
export function setTranscodeResult(id, { status, preview, hlsPath, coverUrl, duration, bpm }) {
  const db = getDb();
  db.prepare(
    `UPDATE tracks
        SET transcode_status = ?,
            preview_path = COALESCE(?, preview_path),
            preview_mime = COALESCE(?, preview_mime),
            preview_size = COALESCE(?, preview_size),
            hls_path     = COALESCE(?, hls_path),
            cover_url    = COALESCE(cover_url, ?),
            duration     = CASE WHEN ? > 0 THEN ? ELSE duration END,
            -- Le tempo mesure ne remplace jamais celui saisi par l'artiste.
            bpm          = COALESCE(bpm, ?)
      WHERE id = ?`,
  ).run(
    status,
    preview?.relativePath || null,
    preview?.mime || null,
    preview?.size || null,
    hlsPath || null,
    coverUrl || null,
    duration || 0,
    duration || 0,
    bpm || null,
    id,
  );
  return getTrack(id);
}

/** Chemin du fichier a servir a l'ecoute : la version allegee si elle existe. */
export function playbackSource(row) {
  if (row.preview_path) {
    return { path: row.preview_path, mime: row.preview_mime || "audio/mpeg" };
  }
  return { path: row.media_path, mime: row.media_mime };
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
