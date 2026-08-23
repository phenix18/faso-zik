import { execute, query, unique } from "@/lib/db";
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

async function slugUnique(artistId, titre) {
  const base = slugify(titre);
  let slug = base;
  let n = 2;
  while (await unique("SELECT 1 FROM albums WHERE artist_id = $1 AND slug = $2", [artistId, slug])) {
    slug = `${base}-${n++}`;
  }
  return slug;
}

const SELECT_ALBUM = `
  SELECT a.*, ar.name AS artist_name, ar.slug AS artist_slug,
         (SELECT COUNT(*)::int FROM tracks t WHERE t.album_id = a.id AND t.published) AS titres,
         (SELECT COALESCE(SUM(t.duration), 0)::int FROM tracks t WHERE t.album_id = a.id AND t.published) AS duree
    FROM albums a JOIN artists ar ON ar.id = a.artist_id
`;

export async function creerAlbum({ artistId, titre, kind = "album", description, coverUrl, releasedOn }) {
  const id = newId("alb");
  await execute(
    `INSERT INTO albums (id, artist_id, title, slug, kind, description, cover_url, released_on)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [
      id,
      artistId,
      titre,
      await slugUnique(artistId, titre),
      typeAlbumValide(kind) ? kind : "album",
      description || null,
      coverUrl || null,
      releasedOn || null,
    ],
  );
  return albumParId(id);
}

export async function albumParId(id) {
  if (!id) return null;
  return unique(`${SELECT_ALBUM} WHERE a.id = $1`, [id]);
}

export async function albumParSlug(artistSlug, slug) {
  return unique(`${SELECT_ALBUM} WHERE ar.slug = $1 AND a.slug = $2`, [artistSlug, slug]);
}

export async function albumsArtiste(artistId, { inclureVides = true } = {}) {
  const albums = await query(
    `${SELECT_ALBUM} WHERE a.artist_id = $1 ORDER BY a.released_on DESC NULLS LAST, a.created_at DESC`,
    [artistId],
  );
  return inclureVides ? albums : albums.filter((album) => album.titres > 0);
}

/** Titres d'un album, dans l'ordre voulu par l'artiste. */
export async function titresAlbum(albumId, { includeUnpublished = false } = {}) {
  const lignes = await query(
    `SELECT t.*, ar.name AS artist_name, ar.slug AS artist_slug,
            ar.photo_url AS artist_photo, ar.verified AS artist_verified,
            al.title AS album_title, al.slug AS album_slug, al.cover_url AS album_cover
       FROM tracks t
       JOIN artists ar ON ar.id = t.artist_id
       LEFT JOIN albums al ON al.id = t.album_id
      WHERE t.album_id = $1 ${includeUnpublished ? "" : "AND t.published"}
      ORDER BY COALESCE(t.track_no, 9999), t.created_at`,
    [albumId],
  );
  return lignes.map(toPublicTrack);
}

/** Derniers albums publies, pour l'accueil. */
export async function albumsRecents(limite = 8) {
  return query(
    `${SELECT_ALBUM}
      WHERE a.published
        AND (SELECT COUNT(*) FROM tracks t WHERE t.album_id = a.id AND t.published) > 0
      ORDER BY a.created_at DESC LIMIT $1`,
    [limite],
  );
}

export async function modifierAlbum(id, champs) {
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

  const sql = entrees.map(([cle], index) => `${correspondance[cle]} = $${index + 1}`).join(", ");
  const valeurs = entrees.map(([cle, valeur]) => (cle === "published" ? !!valeur : valeur));

  await execute(`UPDATE albums SET ${sql} WHERE id = $${entrees.length + 1}`, [...valeurs, id]);
  return albumParId(id);
}

export async function supprimerAlbum(id) {
  // Les titres survivent a leur album : ils redeviennent simplement isoles.
  await execute("DELETE FROM albums WHERE id = $1", [id]);
}

/** Rattache un titre a un album, ou l'en detache si albumId vaut null. */
export async function rattacherTitre(trackId, albumId, trackNo = null) {
  await execute("UPDATE tracks SET album_id = $1, track_no = $2 WHERE id = $3", [
    albumId,
    trackNo,
    trackId,
  ]);
}
