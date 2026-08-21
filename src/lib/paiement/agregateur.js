import crypto from "node:crypto";

/**
 * Fournisseur pour un agregateur mobile money ouest-africain.
 *
 * Plusieurs agregateurs couvrent Orange Money, Moov Money et Wave derriere une
 * seule interface. Leurs API se ressemblent : on demande un paiement, le
 * client confirme sur son telephone, l'agregateur previent le marchand par une
 * notification signee.
 *
 * ATTENTION : ce fichier est une ossature, pas une integration validee. Les
 * noms de champs et la methode de signature different d'un agregateur a
 * l'autre et changent avec le temps. Avant de passer PAIEMENT_FOURNISSEUR a
 * "agregateur", confrontez chaque appel a la documentation en vigueur et
 * testez en environnement bac a sable.
 */

const BASE = process.env.PAIEMENT_API_URL || "";
const CLE = process.env.PAIEMENT_API_CLE || "";
const SECRET = process.env.PAIEMENT_API_SECRET || "";
const SITE = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

function exigerConfiguration() {
  if (!BASE || !CLE || !SECRET) {
    throw new Error(
      "Paiement : renseignez PAIEMENT_API_URL, PAIEMENT_API_CLE et PAIEMENT_API_SECRET.",
    );
  }
}

export const agregateur = {
  nom: "agregateur",
  estSimulation: false,

  async demanderPaiement({ reference, montant, operateur, numero, description }) {
    exigerConfiguration();

    const reponse = await fetch(`${BASE}/payment/init`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${CLE}`,
      },
      body: JSON.stringify({
        amount: montant,
        currency: "XOF",
        reference,
        description,
        channel: operateur,
        customer_phone: numero,
        notify_url: `${SITE}/api/paiements/notification`,
        return_url: `${SITE}/paiement/${reference}`,
      }),
    });

    if (!reponse.ok) {
      throw new Error(`L'agregateur a refuse la demande (${reponse.status}).`);
    }

    const donnees = await reponse.json();
    return {
      providerRef: donnees.transaction_id || donnees.id,
      urlPaiement: donnees.payment_url || null,
      instruction: donnees.instruction || null,
    };
  },

  async verifier(providerRef) {
    exigerConfiguration();

    const reponse = await fetch(`${BASE}/payment/${encodeURIComponent(providerRef)}`, {
      headers: { Authorization: `Bearer ${CLE}` },
    });
    if (!reponse.ok) return { statut: "inconnu" };

    const donnees = await reponse.json();
    const correspondance = { success: "paye", failed: "echoue", pending: "attente" };
    return { statut: correspondance[donnees.status] || "attente" };
  },

  /**
   * Une notification non signee n'est qu'un message anonyme : sans cette
   * verification, n'importe qui pourrait declarer un paiement recu.
   * La comparaison est faite en temps constant.
   */
  verifierSignature(corpsBrut, signature) {
    if (!SECRET || !signature) return false;

    const attendue = crypto.createHmac("sha256", SECRET).update(corpsBrut).digest("hex");
    const a = Buffer.from(attendue);
    const b = Buffer.from(String(signature));
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  },
};
