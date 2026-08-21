import { getDb } from "@/lib/db";
import { newId, slugify } from "@/lib/ids";
import { toPublicTrack } from "@/lib/repo/tracks";

/** Types proposes : un EP et un album ne se presentent pas pareil. */
export const TYPES_ALBUM = [
  { code: "album", nom: "Album" },
  { code: "ep", nom: "EP / Maxi" },
  { code: "single", nom: "Single" },
  { code: "compilation", nom: "Compilation" },
];

export function typeAlbumValide(code) {
  return TYPES_ALBUM.some((type) => type.code === code);
}

function slugUnique(artistId, titre) {
  const db = getDb();
  const base = slugify(titre);
  let slug = base;
  let n = 2;
  while (db.prepare("SELECT 1 FROM albums WHERE artist_id = ? AND slug = ?").get(artistId, slug)) {
    slug = `${base}-${n++}`;
  }
  return slug;
}

export function creerAlbum({ artistId, titre, kind = "album", description, coverUrl, releasedOn }) {
  const id = newId("alb");
  getDb()
    .prepare(
      `INSERT INTO albums (id, artist_id, title, slug, kind, description, cover_url, released_on)
       VALUES (?,?,?,?,?,?,?,?)`,
    )
    .run(
      id,
      artistId,
      titre,
      slugUnique(artistId, titre),
      typeAlbumValide(kind) ? kind : "album",
      description || null,
      coverUrl || null,
      releasedOn || null,
    );
  return albumParId(id);
}

const SELECT_ALBUM = `
  SELECT a.*, ar.name AS artist_name, ar.slug AS artist_slug,
         (SELECT COUNT(*) FROM tracks t WHERE t.album_id = a.id AND t.published = 1) AS titres,
         (SELECT COALESCE(SUM(t.duration), 0) FROM tracks t WHERE t.album_id = a.id AND t.published = 1) AS duree
    FROM albums a JOIN artists ar ON ar.id = a.artist_id
`;

export function albumParId(id) {
  return getDb().prepare(`${SELECT_ALBUM} WHERE a.id = ?`).get(id);
}

export function albumParSlug(artistSlug, slug) {
  return getDb().prepare(`${SELECT_ALBUM} WHERE ar.slug = ? AND a.slug = ?`).get(artistSlug, slug);
}

export function albumsArtiste(artistId, { inclureVides = true } = {}) {
  const albums = getDb()
    .prepare(`${SELECT_ALBUM} WHERE a.artist_id = ? ORDER BY a.released_on DESC, a.created_at DESC`)
    .all(artistId);

  return inclureVides ? albums : albums.filter((album) => album.titres > 0);
}

/** Titres d'un album, dans l'ordre voulu par l'artiste. */
export function titresAlbum(albumId, { includeUnpublished = false } = {}) {
  return getDb()
    .prepare(
      `SELECT t.*, ar.name AS artist_name, ar.slug AS artist_slug,
              ar.photo_url AS artist_photo, ar.verified AS artist_verified
         FROM tracks t JOIN artists ar ON ar.id = t.artist_id
        WHERE t.album_id = ? ${includeUnpublished ? "" : "AND t.published = 1"}
        ORDER BY COALESCE(t.track_no, 9999), t.created_at`,
    )
    .all(albumId)
    .map(toPublicTrack);
}

/** Derniers albums publies, pour l'accueil. */
export function albumsRecents(limite = 8) {
  return getDb()
    .prepare(
      `${SELECT_ALBUM}
        WHERE a.published = 1
          AND (SELECT COUNT(*) FROM tracks t WHERE t.album_id = a.id AND t.published = 1) > 0
        ORDER BY a.created_at DESC LIMIT ?`,
    )
    .all(limite);
}

export function modifierAlbum(id, champs) {
  const correspondance = {
    titre: "title",
    description: "description",
    coverUrl: "cover_url",
    releasedOn: "released_on",
    published: "published",
    kind: "kind",
  };

  const entrees = Object.entries(champs).filter(
    ([cle, valeur]) => correspondance[cle] && valeur !== undefined,
  );
  if (!entrees.length) return albumParId(id);

  const sql = entrees.map(([cle]) => `${correspondance[cle]} = ?`).join(", ");
  const valeurs = entrees.map(([cle, valeur]) =>
    cle === "published" ? (valeur ? 1 : 0) : valeur,
  );
  getDb().prepare(`UPDATE albums SET ${sql} WHERE id = ?`).run(...valeurs, id);
  return albumParId(id);
}

export function supprimerAlbum(id) {
  // Les titres survivent a leur album : ils redeviennent simplement isoles.
  getDb().prepare("DELETE FROM albums WHERE id = ?").run(id);
}

/** Rattache un titre a un album, ou l'en detache si albumId vaut null. */
export function rattacherTitre(trackId, albumId, trackNo = null) {
  getDb()
    .prepare("UPDATE tracks SET album_id = ?, track_no = ? WHERE id = ?")
    .run(albumId, trackNo, trackId);
}
