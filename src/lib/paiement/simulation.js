import { newId } from "@/lib/ids";

/**
 * Fournisseur de developpement.
 *
 * Il imite le cycle d'un paiement mobile money — demande envoyee, client qui
 * confirme sur son telephone, notification en retour — sans appeler aucun
 * service. C'est ce qui permet de tester la chaine complete, y compris les
 * echecs, sans compte marchand.
 */

const enCours = new Map();

export const simulation = {
  nom: "simulation",
  estSimulation: true,

  async demanderPaiement({ reference, montant, operateur, numero }) {
    const jeton = newId("sim");
    enCours.set(jeton, { reference, montant, operateur, numero });

    return {
      providerRef: jeton,
      // En production, l'utilisateur part sur la page de l'operateur ; ici il
      // reste sur le site et confirme lui-meme.
      urlPaiement: `/paiement/${reference}?simulation=${jeton}`,
      instruction: `Composez le code de confirmation ${operateur} sur ${numero}.`,
    };
  },

  /** La confirmation est declenchee par le bouton de la page de simulation. */
  async verifier(providerRef) {
    const demande = enCours.get(providerRef);
    if (!demande) return { statut: "inconnu" };
    return { statut: demande.resolu || "attente" };
  },

  async forcerResultat(providerRef, statut) {
    const demande = enCours.get(providerRef);
    if (!demande) return false;
    demande.resolu = statut;
    return true;
  },

  /** Rien a verifier : aucune notification exterieure n'arrive. */
  verifierSignature() {
    return true;
  },
};
