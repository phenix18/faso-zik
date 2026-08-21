import { getDb } from "@/lib/db";
import { newId } from "@/lib/ids";

/** Part prelevee par la plateforme, en pourcentage du montant encaisse. */
export const COMMISSION_POURCENT = Number(process.env.COMMISSION_POURCENT || 10);

/** Reference lisible, celle que l'auditeur voit sur son recu. */
function nouvelleReference() {
  const jour = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const suffixe = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `FZ-${jour}-${suffixe}`;
}

export function creerPaiement({
  userId,
  artistId,
  trackId = null,
  type,
  montant,
  operateur,
  numero,
  provider,
}) {
  const db = getDb();
  const id = newId("pay");
  const reference = nouvelleReference();

  db.prepare(
    `INSERT INTO payments (
        id, reference, user_id, artist_id, track_id, type,
        amount_cfa, operator, phone, provider
     ) VALUES (?,?,?,?,?,?,?,?,?,?)`,
  ).run(id, reference, userId, artistId, trackId, type, montant, operateur, numero, provider);

  return paiementParId(id);
}

export function paiementParId(id) {
  return getDb().prepare("SELECT * FROM payments WHERE id = ?").get(id);
}

export function paiementParReference(reference) {
  return getDb().prepare("SELECT * FROM payments WHERE reference = ?").get(reference);
}

export function paiementParProviderRef(providerRef) {
  return getDb().prepare("SELECT * FROM payments WHERE provider_ref = ?").get(providerRef);
}

export function enregistrerProviderRef(id, providerRef) {
  getDb().prepare("UPDATE payments SET provider_ref = ? WHERE id = ?").run(providerRef, id);
}

/**
 * Passage a l'etat final.
 *
 * Un paiement deja paye n'est jamais remis en attente ni repaye : les
 * notifications d'un agregateur arrivent parfois en double, ou dans le
 * desordre.
 */
export function conclurePaiement(id, statut, message = null) {
  const db = getDb();
  const paiement = paiementParId(id);
  if (!paiement || paiement.status === "paye") return paiement;

  db.prepare(
    `UPDATE payments
        SET status = ?, message = ?, paid_at = CASE WHEN ? = 'paye' THEN datetime('now') ELSE paid_at END
      WHERE id = ?`,
  ).run(statut, message, statut, id);

  return paiementParId(id);
}

/** L'auditeur a-t-il paye ce titre ? C'est ce qui ouvre son telechargement. */
export function aAchete(userId, trackId) {
  if (!userId || !trackId) return false;
  return !!getDb()
    .prepare(
      `SELECT 1 FROM payments
        WHERE user_id = ? AND track_id = ? AND type = 'achat' AND status = 'paye' LIMIT 1`,
    )
    .get(userId, trackId);
}

export function achatsUtilisateur(userId) {
  return getDb()
    .prepare(
      `SELECT p.*, t.title AS track_title, a.name AS artist_name
         FROM payments p
         LEFT JOIN tracks t ON t.id = p.track_id
         JOIN artists a ON a.id = p.artist_id
        WHERE p.user_id = ? AND p.status = 'paye'
        ORDER BY p.paid_at DESC`,
    )
    .all(userId);
}

/** Ce que l'artiste a encaisse, ce que la plateforme retient, ce qui lui revient. */
export function revenusArtiste(artistId) {
  const db = getDb();
  const totaux = db
    .prepare(
      `SELECT COALESCE(SUM(amount_cfa), 0)                                        AS brut,
              COALESCE(SUM(CASE WHEN type = 'achat' THEN amount_cfa END), 0)      AS achats,
              COALESCE(SUM(CASE WHEN type = 'pourboire' THEN amount_cfa END), 0)  AS pourboires,
              COUNT(*)                                                            AS operations
         FROM payments WHERE artist_id = ? AND status = 'paye'`,
    )
    .get(artistId);

  const commission = Math.round((totaux.brut * COMMISSION_POURCENT) / 100);
  return { ...totaux, commission, net: totaux.brut - commission, tauxCommission: COMMISSION_POURCENT };
}

export function paiementsArtiste(artistId, limite = 50) {
  return getDb()
    .prepare(
      `SELECT p.*, t.title AS track_title, u.name AS acheteur
         FROM payments p
         LEFT JOIN tracks t ON t.id = p.track_id
         LEFT JOIN users u ON u.id = p.user_id
        WHERE p.artist_id = ? AND p.status = 'paye'
        ORDER BY p.paid_at DESC LIMIT ?`,
    )
    .all(artistId, limite);
}
