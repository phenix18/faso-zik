import { execute, query, unique } from "@/lib/db";
import { newId } from "@/lib/ids";

/** Part prelevee par la plateforme, en pourcentage du montant encaisse. */
export const COMMISSION_POURCENT = Number(process.env.COMMISSION_POURCENT || 10);

/** Reference lisible, celle que l'auditeur voit sur son recu. */
function nouvelleReference() {
  const jour = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const suffixe = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `FZ-${jour}-${suffixe}`;
}

export async function creerPaiement({
  userId,
  artistId,
  trackId = null,
  type,
  montant,
  operateur,
  numero,
  provider,
}) {
  const id = newId("pay");
  await execute(
    `INSERT INTO payments (
        id, reference, user_id, artist_id, track_id, type,
        amount_cfa, operator, phone, provider
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [id, nouvelleReference(), userId, artistId, trackId, type, montant, operateur, numero, provider],
  );
  return paiementParId(id);
}

export async function paiementParId(id) {
  return unique("SELECT * FROM payments WHERE id = $1", [id]);
}

export async function paiementParReference(reference) {
  return unique("SELECT * FROM payments WHERE reference = $1", [reference]);
}

export async function paiementParProviderRef(providerRef) {
  if (!providerRef) return null;
  return unique("SELECT * FROM payments WHERE provider_ref = $1", [providerRef]);
}

export async function enregistrerProviderRef(id, providerRef) {
  await execute("UPDATE payments SET provider_ref = $1 WHERE id = $2", [providerRef, id]);
}

/**
 * Passage a l'etat final.
 *
 * La condition `status <> 'paye'` est dans la requete elle-meme : deux
 * notifications simultanees ne peuvent pas conclure deux fois le meme
 * paiement, meme reparties sur deux instances.
 */
export async function conclurePaiement(id, statut, message = null) {
  await execute(
    `UPDATE payments
        SET status = $1,
            message = $2,
            paid_at = CASE WHEN $1 = 'paye' THEN now() ELSE paid_at END
      WHERE id = $3 AND status <> 'paye'`,
    [statut, message, id],
  );
  return paiementParId(id);
}

/** L'auditeur a-t-il paye ce titre ? C'est ce qui ouvre son telechargement. */
export async function aAchete(userId, trackId) {
  if (!userId || !trackId) return false;
  return !!(await unique(
    `SELECT 1 FROM payments
      WHERE user_id = $1 AND track_id = $2 AND type = 'achat' AND status = 'paye' LIMIT 1`,
    [userId, trackId],
  ));
}

export async function achatsUtilisateur(userId) {
  return query(
    `SELECT p.*, t.title AS track_title, a.name AS artist_name
       FROM payments p
       LEFT JOIN tracks t ON t.id = p.track_id
       JOIN artists a ON a.id = p.artist_id
      WHERE p.user_id = $1 AND p.status = 'paye'
      ORDER BY p.paid_at DESC`,
    [userId],
  );
}

/** Ce que l'artiste a encaisse, ce que la plateforme retient, ce qui lui revient. */
export async function revenusArtiste(artistId) {
  const totaux = await unique(
    `SELECT COALESCE(SUM(amount_cfa), 0)::int                                     AS brut,
            COALESCE(SUM(amount_cfa) FILTER (WHERE type = 'achat'), 0)::int       AS achats,
            COALESCE(SUM(amount_cfa) FILTER (WHERE type = 'pourboire'), 0)::int   AS pourboires,
            COUNT(*)::int                                                         AS operations
       FROM payments WHERE artist_id = $1 AND status = 'paye'`,
    [artistId],
  );

  const commission = Math.round((totaux.brut * COMMISSION_POURCENT) / 100);
  return {
    ...totaux,
    commission,
    net: totaux.brut - commission,
    tauxCommission: COMMISSION_POURCENT,
  };
}

export async function paiementsArtiste(artistId, limite = 50) {
  return query(
    `SELECT p.*, t.title AS track_title, u.name AS acheteur
       FROM payments p
       LEFT JOIN tracks t ON t.id = p.track_id
       LEFT JOIN users u ON u.id = p.user_id
      WHERE p.artist_id = $1 AND p.status = 'paye'
      ORDER BY p.paid_at DESC LIMIT $2`,
    [artistId, limite],
  );
}
