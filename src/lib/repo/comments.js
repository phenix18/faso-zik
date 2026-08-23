import { execute, query, unique } from "@/lib/db";
import { newId } from "@/lib/ids";

/**
 * Commentaires sous un morceau.
 *
 * Ecrire exige un compte : sans identite, aucune moderation n'est possible et
 * la page se remplit en une nuit. Lire n'en demande pas — un auditeur de
 * passage doit voir ce qui se dit.
 */

const LIMITE = 2000;

function publier(ligne) {
  return {
    id: ligne.id,
    corps: ligne.corps,
    auteur: { id: ligne.user_id, nom: ligne.auteur_nom },
    createdAt: ligne.created_at,
  };
}

/** Commentaires visibles, du plus recent au plus ancien. */
export async function commentairesDuTitre(trackId, { limite = 100 } = {}) {
  const lignes = await query(
    `SELECT c.id, c.corps, c.user_id, c.created_at, u.name AS auteur_nom
       FROM comments c
       JOIN users u ON u.id = c.user_id
      WHERE c.track_id = $1 AND NOT c.masque
      ORDER BY c.created_at DESC
      LIMIT $2`,
    [trackId, limite],
  );
  return lignes.map(publier);
}

export async function compterCommentaires(trackId) {
  const ligne = await unique(
    "SELECT count(*)::int AS n FROM comments WHERE track_id = $1 AND NOT masque",
    [trackId],
  );
  return ligne?.n || 0;
}

export async function ajouterCommentaire({ trackId, userId, corps }) {
  // Les caracteres de controle n'apportent rien et brouillent l'affichage.
  const texte = String(corps || "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .trim()
    .slice(0, LIMITE);
  if (!texte) throw new Error("Le commentaire est vide.");

  const id = newId("cmt");
  await execute("INSERT INTO comments (id, track_id, user_id, corps) VALUES ($1, $2, $3, $4)", [
    id,
    trackId,
    userId,
    texte,
  ]);
  return commentaireParId(id);
}

export async function commentaireParId(id) {
  const ligne = await unique(
    `SELECT c.id, c.corps, c.user_id, c.track_id, c.masque, c.created_at, u.name AS auteur_nom
       FROM comments c
       JOIN users u ON u.id = c.user_id
      WHERE c.id = $1`,
    [id],
  );
  return ligne ? { ...publier(ligne), trackId: ligne.track_id, masque: ligne.masque } : null;
}

/**
 * Retrait d'un commentaire : masque, jamais efface.
 *
 * Une moderation se conteste ; garder la ligne permet d'y revenir, et de
 * savoir qui a retire quoi.
 */
export async function masquerCommentaire(id, parUserId) {
  await execute("UPDATE comments SET masque = TRUE, masque_par = $2 WHERE id = $1", [id, parUserId]);
}

/** Derniers commentaires du site, pour la moderation. */
export async function derniersCommentaires(limite = 30) {
  const lignes = await query(
    `SELECT c.id, c.corps, c.user_id, c.created_at, c.masque,
            u.name AS auteur_nom, t.title AS titre, t.id AS track_id
       FROM comments c
       JOIN users u ON u.id = c.user_id
       JOIN tracks t ON t.id = c.track_id
      ORDER BY c.created_at DESC
      LIMIT $1`,
    [limite],
  );
  return lignes.map((ligne) => ({
    ...publier(ligne),
    trackId: ligne.track_id,
    titre: ligne.titre,
    masque: ligne.masque,
  }));
}
