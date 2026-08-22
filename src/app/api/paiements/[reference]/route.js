import { currentUser } from "@/lib/auth";
import { conclurePaiement, paiementParReference } from "@/lib/repo/payments";
import { fournisseurActif, PaiementIndisponible } from "@/lib/paiement";
import { fail, json } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Etat d'un paiement, consulte par la page d'attente. */
export async function GET(_request, { params }) {
  const user = await currentUser();
  const paiement = await paiementParReference(params.reference);
  if (!paiement) return fail("Paiement introuvable.", 404);
  if (!user || paiement.user_id !== user.id) return fail("Ce paiement ne vous appartient pas.", 403);

  // Une notification peut se perdre : on interroge le fournisseur tant que
  // le paiement n'est pas conclu.
  if (paiement.status === "attente" && paiement.provider_ref) {
    try {
      const { statut } = await fournisseurActif().verifier(paiement.provider_ref);
      if (statut === "paye" || statut === "echoue") {
        return json({ paiement: publier(await conclurePaiement(paiement.id, statut)) });
      }
    } catch {
      // Fournisseur injoignable : on renvoie l'etat connu plutot qu'une erreur.
    }
  }

  return json({ paiement: publier(paiement) });
}

/**
 * Confirmation manuelle, reservee au fournisseur de simulation.
 *
 * En production, seule la notification signee du fournisseur conclut un
 * paiement : cette route refuse d'agir des que le fournisseur est reel.
 */
export async function POST(request, { params }) {
  let fournisseur;
  try {
    fournisseur = fournisseurActif();
  } catch (erreur) {
    if (erreur instanceof PaiementIndisponible) return fail(erreur.message, 503);
    throw erreur;
  }

  if (!fournisseur.estSimulation) {
    return fail("Confirmation manuelle indisponible avec ce fournisseur.", 403);
  }

  const user = await currentUser();
  const paiement = await paiementParReference(params.reference);
  if (!paiement) return fail("Paiement introuvable.", 404);
  if (!user || paiement.user_id !== user.id) return fail("Ce paiement ne vous appartient pas.", 403);

  const { resultat } = await request.json().catch(() => ({}));
  const statut = resultat === "echoue" ? "echoue" : "paye";
  await fournisseur.forcerResultat(paiement.provider_ref, statut);

  return json({ paiement: publier(await conclurePaiement(paiement.id, statut, "Confirmation simulee")) });
}

async function publier(paiement) {
  return {
    reference: paiement.reference,
    type: paiement.type,
    montant: paiement.amount_cfa,
    operateur: paiement.operator,
    statut: paiement.status,
    trackId: paiement.track_id,
    message: paiement.message,
    paidAt: paiement.paid_at,
  };
}
