import { getDb } from "@/lib/db";
import { toPublicTrack } from "@/lib/repo/tracks";

const JOINED = `
  SELECT t.*, a.name AS artist_name, a.slug AS artist_slug,
         a.photo_url AS artist_photo, a.verified AS artist_verified
    FROM tracks t JOIN artists a ON a.id = t.artist_id
`;

/* ------------------------------ abonnements ----------------------------- */

export function suit(userId, artistId) {
  if (!userId) return false;
  return !!getDb()
    .prepare("SELECT 1 FROM follows WHERE user_id = ? AND artist_id = ?")
    .get(userId, artistId);
}

export function basculerAbonnement(userId, artistId) {
  const db = getDb();
  if (suit(userId, artistId)) {
    db.prepare("DELETE FROM follows WHERE user_id = ? AND artist_id = ?").run(userId, artistId);
    return false;
  }
  db.prepare("INSERT INTO follows (user_id, artist_id) VALUES (?, ?)").run(userId, artistId);
  return true;
}

export function nombreAbonnes(artistId) {
  return getDb().prepare("SELECT COUNT(*) AS n FROM follows WHERE artist_id = ?").get(artistId).n;
}

export function artistesSuivis(userId) {
  return getDb()
    .prepare(
      `SELECT a.*, (SELECT COUNT(*) FROM tracks t WHERE t.artist_id = a.id AND t.published = 1) AS track_count
         FROM follows f JOIN artists a ON a.id = f.artist_id
        WHERE f.user_id = ? ORDER BY a.name`,
    )
    .all(userId);
}

/** Sorties des artistes suivis, les plus recentes d'abord. */
export function nouveautesSuivies(userId, limite = 60) {
  return getDb()
    .prepare(
      `${JOINED} JOIN follows f ON f.artist_id = t.artist_id
        WHERE f.user_id = ? AND t.published = 1
        ORDER BY t.created_at DESC LIMIT ?`,
    )
    .all(userId, limite)
    .map(toPublicTrack);
}

/* ------------------------------- classement ----------------------------- */

/**
 * Classement des sept derniers jours, etabli sur les ecoutes datees et non sur
 * le compteur cumule : sinon les titres anciens occuperaient la tete pour
 * toujours.
 */
export function classementSemaine(limite = 20) {
  // Requete ecrite en entier plutot que fondee sur JOINED : le decompte de la
  // semaine doit figurer dans la liste des colonnes selectionnees.
  return getDb()
    .prepare(
      `SELECT t.*, e.ecoutes,
              a.name AS artist_name, a.slug AS artist_slug,
              a.photo_url AS artist_photo, a.verified AS artist_verified
         FROM tracks t
         JOIN artists a ON a.id = t.artist_id
         JOIN (
           SELECT track_id, COUNT(*) AS ecoutes
             FROM events
            WHERE type = 'play' AND created_at >= datetime('now', '-7 days')
            GROUP BY track_id
         ) e ON e.track_id = t.id
        WHERE t.published = 1
        ORDER BY e.ecoutes DESC, t.created_at DESC
        LIMIT ?`,
    )
    .all(limite)
    .map((row) => ({ ...toPublicTrack(row), ecoutesSemaine: row.ecoutes }));
}
