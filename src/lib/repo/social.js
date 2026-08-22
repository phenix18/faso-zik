import { execute, query, unique } from "@/lib/db";
import { toPublicTrack } from "@/lib/repo/tracks";

const JOINED = `
  SELECT t.*, a.name AS artist_name, a.slug AS artist_slug,
         a.photo_url AS artist_photo, a.verified AS artist_verified,
         al.title AS album_title, al.slug AS album_slug, al.cover_url AS album_cover
    FROM tracks t
    JOIN artists a ON a.id = t.artist_id
    LEFT JOIN albums al ON al.id = t.album_id
`;

/* ------------------------------ abonnements ----------------------------- */

export async function suit(userId, artistId) {
  if (!userId) return false;
  return !!(await unique("SELECT 1 FROM follows WHERE user_id = $1 AND artist_id = $2", [
    userId,
    artistId,
  ]));
}

export async function basculerAbonnement(userId, artistId) {
  if (await suit(userId, artistId)) {
    await execute("DELETE FROM follows WHERE user_id = $1 AND artist_id = $2", [userId, artistId]);
    return false;
  }
  await execute("INSERT INTO follows (user_id, artist_id) VALUES ($1, $2)", [userId, artistId]);
  return true;
}

export async function nombreAbonnes(artistId) {
  const ligne = await unique("SELECT COUNT(*)::int AS n FROM follows WHERE artist_id = $1", [
    artistId,
  ]);
  return ligne.n;
}

export async function artistesSuivis(userId) {
  return query(
    `SELECT a.*,
            (SELECT COUNT(*)::int FROM tracks t WHERE t.artist_id = a.id AND t.published) AS track_count
       FROM follows f JOIN artists a ON a.id = f.artist_id
      WHERE f.user_id = $1 ORDER BY a.name`,
    [userId],
  );
}

/** Sorties des artistes suivis, les plus recentes d'abord. */
export async function nouveautesSuivies(userId, limite = 60) {
  const lignes = await query(
    `${JOINED} JOIN follows f ON f.artist_id = t.artist_id
      WHERE f.user_id = $1 AND t.published
      ORDER BY t.created_at DESC LIMIT $2`,
    [userId, limite],
  );
  return lignes.map(toPublicTrack);
}

/* ------------------------------- classement ----------------------------- */

/**
 * Classement des sept derniers jours, etabli sur les ecoutes datees et non sur
 * le compteur cumule : sinon les titres anciens occuperaient la tete pour
 * toujours.
 */
export async function classementSemaine(limite = 20) {
  const lignes = await query(
    `SELECT t.*, e.ecoutes,
            a.name AS artist_name, a.slug AS artist_slug,
            a.photo_url AS artist_photo, a.verified AS artist_verified,
            al.title AS album_title, al.slug AS album_slug, al.cover_url AS album_cover
       FROM tracks t
       JOIN artists a ON a.id = t.artist_id
       LEFT JOIN albums al ON al.id = t.album_id
       JOIN (
         SELECT track_id, COUNT(*)::int AS ecoutes
           FROM events
          WHERE type = 'play' AND created_at >= now() - interval '7 days'
          GROUP BY track_id
       ) e ON e.track_id = t.id
      WHERE t.published
      ORDER BY e.ecoutes DESC, t.created_at DESC
      LIMIT $1`,
    [limite],
  );

  return lignes.map((row) => ({ ...toPublicTrack(row), ecoutesSemaine: row.ecoutes }));
}
