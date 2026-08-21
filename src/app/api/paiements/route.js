import { z } from "zod";
import { currentUser } from "@/lib/auth";
import { getArtistById } from "@/lib/repo/artists";
import { getTrackRow } from "@/lib/repo/tracks";
import { aAchete, creerPaiement, enregistrerProviderRef } from "@/lib/repo/payments";
import { estPayant } from "@/lib/permissions";
import {
  fournisseurActif,
  normaliserNumero,
  operateurValide,
  PaiementIndisponible,
} from "@/lib/paiement";
import { clientKey, rateLimit, tooManyRequests } from "@/lib/rateLimit";
import { fail, json } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MONTANT_MINIMUM = 100; // francs CFA

const schema = z.object({
  type: z.enum(["achat", "pourboire"]),
  trackId: z.string().optional(),
  artistId: z.string().optional(),
  montant: z.number().int().positive().optional(),
  operateur: z.string(),
  numero: z.string(),
});

/**
 * Ouvre un paiement mobile money.
 *
 * Pour un achat, le montant vient du prix fixe par l'artiste et jamais du
 * navigateur : sinon n'importe qui achetterait un titre a un franc.
 */
export async function POST(request) {
  const limite = rateLimit(clientKey(request, "paiement"), {
    limit: 15,
    windowMs: 10 * 60 * 1000,
  });
  if (!limite.allowed) {
    return tooManyRequests(limite.retryAfter, "Trop de demandes de paiement. Patientez un moment.");
  }

  const user = await currentUser();
  if (!user) return fail("Connectez-vous pour payer.", 401);

  let corps;
  try {
    corps = schema.parse(await request.json());
  } catch (erreur) {
    return fail(erreur.errors?.[0]?.message || "Demande de paiement invalide.", 422);
  }

  if (!operateurValide(corps.operateur)) return fail("Operateur inconnu.", 422);

  const numero = normaliserNumero(corps.numero);
  if (!numero) return fail("Numero invalide : 8 chiffres attendus.", 422);

  let artistId;
  let trackId = null;
  let montant;
  let description;

  if (corps.type === "achat") {
    const morceau = getTrackRow(corps.trackId || "");
    if (!morceau) return fail("Morceau introuvable.", 404);
    if (!estPayant(morceau)) return fail("Ce titre n'est pas en vente.", 409);
    if (aAchete(user.id, morceau.id)) return fail("Vous avez deja achete ce titre.", 409);

    artistId = morceau.artist_id;
    trackId = morceau.id;
    montant = morceau.price_cfa;
    description = `${morceau.title} — ${morceau.artist_name}`;
  } else {
    const artiste = getArtistById(corps.artistId || "");
    if (!artiste) return fail("Artiste introuvable.", 404);
    if (!corps.montant || corps.montant < MONTANT_MINIMUM) {
      return fail(`Le pourboire minimum est de ${MONTANT_MINIMUM} F CFA.`, 422);
    }

    artistId = artiste.id;
    montant = corps.montant;
    description = `Soutien a ${artiste.name}`;
  }

  let fournisseur;
  try {
    fournisseur = fournisseurActif();
  } catch (erreur) {
    if (erreur instanceof PaiementIndisponible) return fail(erreur.message, 503);
    throw erreur;
  }

  const paiement = creerPaiement({
    userId: user.id,
    artistId,
    trackId,
    type: corps.type,
    montant,
    operateur: corps.operateur,
    numero,
    provider: fournisseur.nom,
  });

  try {
    const demande = await fournisseur.demanderPaiement({
      reference: paiement.reference,
      montant,
      operateur: corps.operateur,
      numero,
      description,
    });
    enregistrerProviderRef(paiement.id, demande.providerRef);

    return json(
      {
        reference: paiement.reference,
        montant,
        urlPaiement: demande.urlPaiement,
        instruction: demande.instruction,
        simulation: !!fournisseur.estSimulation,
      },
      201,
    );
  } catch (erreur) {
    return fail(`Le paiement n'a pas pu etre ouvert : ${erreur.message}`, 502);
  }
}
