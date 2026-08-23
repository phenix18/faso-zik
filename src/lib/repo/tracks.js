import { execute, query, unique } from "@/lib/db";
import { newId, slugify } from "@/lib/ids";

const SELECT_TRACK = `
  SELECT t.*,
         a.name       AS artist_name,
         a.slug       AS artist_slug,
         a.photo_url  AS artist_photo,
         a.verified   AS artist_verified,
         al.title     AS album_title,
         al.slug      AS album_slug,
         al.cover_url AS album_cover
    FROM tracks t
    JOIN artists a ON a.id = t.artist_id
    LEFT JOIN albums al ON al.id = t.album_id
`;

/** Forme envoyee au navigateur : jamais le chemin de stockage du fichier. */
export function toPublicTrack(row) {
  if (!row) return null;

  // Les entiers larges reviennent parfois en chaine selon le pilote : on les
  // ramene a des nombres avant de les envoyer au navigateur.
  const taille = Number(row.media_size) || 0;
  const tailleEcoute = row.preview_size == null ? taille : Number(row.preview_size);

  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    kind: row.kind,
    genre: row.genre,
    language: row.language,
    description: row.description,
    duration: Number(row.duration) || 0,
    bpm: row.bpm == null ? null : Number(row.bpm),
    musicKey: row.music_key,
    // A defaut de pochette propre, celle de l'album : un titre isole dans une
    // liste d'album ne doit pas jurer avec ses voisins.
    coverUrl: row.cover_url || row.album_cover || null,
    album: row.album_id
      ? { id: row.album_id, title: row.album_title, slug: row.album_slug, trackNo: row.track_no }
      : null,
    mime: row.media_mime,
    size: taille,
    streamSize: tailleEcoute,
    hasPreview: !!row.preview_path,
    license: row.license,
    priceCfa: row.price_cfa || 0,
    rightsConfirmed: !!row.rights_confirmed,
    published: !!row.published,
    plays: row.plays,
    downloads: row.downloads,
    createdAt: row.created_at,
    permissions: {
      stream: !!row.allow_stream,
      download: !!row.allow_download,
      dj: !!row.allow_dj,
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
    // Le lien direct n'apparait que pour un telechargement gratuit ; un titre
    // payant passe d'abord par la page de paiement.
    downloadUrl: row.allow_download && !(row.price_cfa || 0) ? `/api/download/${row.id}` : null,
  };
}

export async function getTrackRow(id) {
  if (!id) return null;
  return unique(`${SELECT_TRACK} WHERE t.id = $1`, [id]);
}

export async function getTrack(id) {
  return toPublicTrack(await getTrackRow(id));
}

export async function listTracks({
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
  const lier = (valeur) => {
    params.push(valeur);
    return `$${params.length}`;
  };

  if (!includeUnpublished) where.push("t.published");
  if (kind) where.push(`t.kind = ${lier(kind)}`);
  if (artistId) where.push(`t.artist_id = ${lier(artistId)}`);
  if (artistSlug) where.push(`a.slug = ${lier(artistSlug)}`);
  if (albumId) where.push(`t.album_id = ${lier(albumId)}`);
  if (genre) where.push(`LOWER(t.genre) = LOWER(${lier(genre)})`);

  if (search.trim()) {
    const like = lier(`%${search.trim()}%`);
    where.push(`(t.title ILIKE ${like} OR a.name ILIKE ${like} OR t.genre ILIKE ${like} OR t.language ILIKE ${like})`);
  }

  // Le tri vient d'une liste fermee : jamais du texte recu.
  const order =
    { populaire: "t.plays DESC, t.created_at DESC", titre: "t.title ASC" }[sort] ||
    "t.created_at DESC";

  const lignes = await query(
    `${SELECT_TRACK}
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY ${order}
      LIMIT ${lier(limit)} OFFSET ${lier(offset)}`,
    params,
  );

  return lignes.map(toPublicTrack);
}

export async function listGenres() {
  return query(
    `SELECT genre, COUNT(*)::int AS n
       FROM tracks
      WHERE published AND genre IS NOT NULL AND genre <> ''
      GROUP BY genre ORDER BY n DESC LIMIT 24`,
  );
}

export async function uniqueTrackSlug(artistId, title) {
  const base = slugify(title);
  let slug = base;
  let n = 2;
  while (await unique("SELECT 1 FROM tracks WHERE artist_id = $1 AND slug = $2", [artistId, slug])) {
    slug = `${base}-${n++}`;
  }
  return slug;
}

export async function createTrack(data) {
  const id = newId("trk");
  const slug = await uniqueTrackSlug(data.artistId, data.title);

  await execute(
    `INSERT INTO tracks (
        id, artist_id, album_id, track_no, title, slug, kind, genre, language, description,
        duration, bpm, music_key, cover_url, media_path, media_mime, media_size,
        preview_path, preview_mime, preview_size,
        allow_stream, allow_download, allow_dj, license, rights_confirmed, published, price_cfa
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27)`,
    [
      id,
      data.artistId,
      data.albumId || null,
      data.trackNo || null,
      data.title,
      slug,
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
      data.previewPath || null,
      data.previewMime || null,
      data.previewSize || null,
      data.allowStream !== false,
      !!data.allowDownload,
      !!data.allowDj,
      data.license || "Tous droits reserves",
      !!data.rightsConfirmed,
      data.published !== false,
      Math.max(0, Math.round(Number(data.priceCfa) || 0)),
    ],
  );

  return getTrack(id);
}

/**
 * Mise a jour reservee au proprietaire du morceau (verifie par l'appelant).
 * Ce sont notamment les autorisations que l'artiste accorde ou retire.
 */
export async function updateTrack(id, fields) {
  const map = {
    title: "title",
    genre: "genre",
    language: "language",
    description: "description",
    bpm: "bpm",
    musicKey: "music_key",
    coverUrl: "cover_url",
    license: "license",
    priceCfa: "price_cfa",
    albumId: "album_id",
    trackNo: "track_no",
    allowStream: "allow_stream",
    allowDownload: "allow_download",
    allowDj: "allow_dj",
    published: "published",
  };
  const booleens = new Set(["allowStream", "allowDownload", "allowDj", "published"]);

  const entries = Object.entries(fields).filter(([key, value]) => map[key] && value !== undefined);
  if (!entries.length) return getTrack(id);

  const setSql = entries.map(([key], index) => `${map[key]} = $${index + 1}`).join(", ");
  const valeurs = entries.map(([key, value]) => (booleens.has(key) ? !!value : value));

  await execute(`UPDATE tracks SET ${setSql} WHERE id = $${entries.length + 1}`, [...valeurs, id]);
  return getTrack(id);
}

export async function deleteTrack(id) {
  await execute("DELETE FROM tracks WHERE id = $1", [id]);
}

/** Chemin du fichier a servir a l'ecoute : la version allegee si elle existe. */
export function playbackSource(row) {
  if (row.preview_path) {
    return { path: row.preview_path, mime: row.preview_mime || "audio/mpeg" };
  }
  return { path: row.media_path, mime: row.media_mime };
}

export async function recordEvent(trackId, type, userId = null) {
  await execute("INSERT INTO events (track_id, user_id, type) VALUES ($1, $2, $3)", [
    trackId,
    userId,
    type,
  ]);

  if (type === "play") {
    await execute("UPDATE tracks SET plays = plays + 1 WHERE id = $1", [trackId]);
  } else if (type === "download") {
    await execute("UPDATE tracks SET downloads = downloads + 1 WHERE id = $1", [trackId]);
  }
}
