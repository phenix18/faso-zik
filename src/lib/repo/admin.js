import { getDb } from "@/lib/db";

/**
 * Operations reservees a l'administration.
 *
 * Elles ne verifient pas les droits : c'est la route appelante qui le fait,
 * une seule fois, avant d'appeler ces fonctions.
 */

export function vueEnsemble() {
  const db = getDb();
  const compte = (requete) => db.prepare(requete).get().n;

  return {
    artistes: compte("SELECT COUNT(*) AS n FROM artists"),
    artistesVerifies: compte("SELECT COUNT(*) AS n FROM artists WHERE verified = 1"),
    titres: compte("SELECT COUNT(*) AS n FROM tracks"),
    titresEnLigne: compte("SELECT COUNT(*) AS n FROM tracks WHERE published = 1"),
    comptes: compte("SELECT COUNT(*) AS n FROM users"),
    ecoutes7j: compte(
      "SELECT COUNT(*) AS n FROM events WHERE type = 'play' AND created_at >= datetime('now','-7 days')",
    ),
    paiements: compte("SELECT COUNT(*) AS n FROM payments WHERE status = 'paye'"),
  };
}

export function listeArtistes() {
  return getDb()
    .prepare(
      `SELECT a.*, u.email,
              (SELECT COUNT(*) FROM tracks t WHERE t.artist_id = a.id) AS titres
         FROM artists a LEFT JOIN users u ON u.id = a.user_id
        ORDER BY a.verified DESC, a.created_at DESC`,
    )
    .all();
}

export function basculerVerification(artistId) {
  const db = getDb();
  const artiste = db.prepare("SELECT verified FROM artists WHERE id = ?").get(artistId);
  if (!artiste) return null;

  const nouvelEtat = artiste.verified ? 0 : 1;
  db.prepare("UPDATE artists SET verified = ? WHERE id = ?").run(nouvelEtat, artistId);
  return !!nouvelEtat;
}

/**
 * Retrait d'un titre de la diffusion.
 *
 * On depublie plutot que de supprimer : une reclamation peut etre infondee, et
 * le fichier de l'artiste ne doit pas disparaitre pour autant.
 */
export function retirerTitre(trackId) {
  getDb().prepare("UPDATE tracks SET published = 0 WHERE id = ?").run(trackId);
}

export function derniersTitres(limite = 40) {
  return getDb()
    .prepare(
      `SELECT t.id, t.title, t.kind, t.published, t.created_at, a.name AS artiste, a.slug
         FROM tracks t JOIN artists a ON a.id = t.artist_id
        ORDER BY t.created_at DESC LIMIT ?`,
    )
    .all(limite);
}
