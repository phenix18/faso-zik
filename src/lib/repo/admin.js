import { execute, query, unique } from "@/lib/db";

/**
 * Operations reservees a l'administration.
 *
 * Elles ne verifient pas les droits : c'est la route appelante qui le fait,
 * une seule fois, avant d'appeler ces fonctions.
 */

export async function vueEnsemble() {
  const ligne = await unique(`
    SELECT
      (SELECT COUNT(*)::int FROM artists)                       AS artistes,
      (SELECT COUNT(*)::int FROM artists WHERE verified)        AS "artistesVerifies",
      (SELECT COUNT(*)::int FROM tracks)                        AS titres,
      (SELECT COUNT(*)::int FROM tracks WHERE published)        AS "titresEnLigne",
      (SELECT COUNT(*)::int FROM users)                         AS comptes,
      (SELECT COUNT(*)::int FROM events
        WHERE type = 'play' AND created_at >= now() - interval '7 days') AS "ecoutes7j",
      (SELECT COUNT(*)::int FROM payments WHERE status = 'paye') AS paiements
  `);
  return ligne;
}

export async function listeArtistes() {
  return query(
    `SELECT a.*, u.email,
            (SELECT COUNT(*)::int FROM tracks t WHERE t.artist_id = a.id) AS titres
       FROM artists a LEFT JOIN users u ON u.id = a.user_id
      ORDER BY a.verified DESC, a.created_at DESC`,
  );
}

export async function basculerVerification(artistId) {
  const artiste = await unique("SELECT verified FROM artists WHERE id = $1", [artistId]);
  if (!artiste) return null;

  const nouvelEtat = !artiste.verified;
  await execute("UPDATE artists SET verified = $1 WHERE id = $2", [nouvelEtat, artistId]);
  return nouvelEtat;
}

/**
 * Retrait d'un titre de la diffusion.
 *
 * On depublie plutot que de supprimer : une reclamation peut etre infondee, et
 * le fichier de l'artiste ne doit pas disparaitre pour autant.
 */
export async function retirerTitre(trackId) {
  await execute("UPDATE tracks SET published = FALSE WHERE id = $1", [trackId]);
}

export async function derniersTitres(limite = 40) {
  return query(
    `SELECT t.id, t.title, t.kind, t.published, t.created_at, a.name AS artiste, a.slug
       FROM tracks t JOIN artists a ON a.id = t.artist_id
      ORDER BY t.created_at DESC LIMIT $1`,
    [limite],
  );
}
