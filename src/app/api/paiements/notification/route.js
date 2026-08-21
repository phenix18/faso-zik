import { conclurePaiement, paiementParProviderRef, paiementParReference } from "@/lib/repo/payments";
import { fournisseurActif } from "@/lib/paiement";
import { fail, json } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Notification du fournisseur de paiement.
 *
 * Le corps est lu en texte brut avant tout traitement : la signature porte sur
 * les octets recus, pas sur le resultat d'un aller-retour JSON qui pourrait
 * reordonner les cles. Sans signature valide, rien n'est pris en compte — une
 * notification anonyme suffirait sinon a se declarer paye.
 */
export async function POST(request) {
  const fournisseur = fournisseurActif();

  // Le fournisseur de simulation ne verifie aucune signature : accepter des
  // notifications dans ce mode reviendrait a laisser n'importe qui declarer un
  // paiement recu. Les confirmations de developpement passent par
  // /api/paiements/[reference], qui verifie a qui appartient le paiement.
  if (fournisseur.estSimulation) {
    return fail("Notifications indisponibles avec le fournisseur de simulation.", 403);
  }

  const corpsBrut = await request.text();
  const signature =
    request.headers.get("x-signature") ||
    request.headers.get("x-webhook-signature") ||
    request.headers.get("signature");

  if (!fournisseur.verifierSignature(corpsBrut, signature)) {
    return fail("Signature absente ou invalide.", 401);
  }

  let donnees;
  try {
    donnees = JSON.parse(corpsBrut);
  } catch {
    return fail("Corps illisible.", 400);
  }

  const paiement =
    (donnees.transaction_id && paiementParProviderRef(donnees.transaction_id)) ||
    (donnees.reference && paiementParReference(donnees.reference));

  if (!paiement) return fail("Paiement inconnu.", 404);

  const correspondance = { success: "paye", failed: "echoue", cancelled: "echoue" };
  const statut = correspondance[donnees.status];
  if (!statut) return json({ ignore: true });

  conclurePaiement(paiement.id, statut, donnees.message || null);
  return json({ ok: true });
}
