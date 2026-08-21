import { simulation } from "@/lib/paiement/simulation";
import { agregateur } from "@/lib/paiement/agregateur";

/**
 * Paiements mobile money.
 *
 * Au Burkina Faso, l'argent circule par Orange Money, Moov Money et les
 * portefeuilles voisins, pas par carte bancaire. L'application ne parle donc
 * jamais a un operateur en direct : elle passe par un fournisseur, choisi par
 * configuration, qui expose quatre operations. En brancher un autre revient a
 * ecrire un fichier dans ce dossier.
 *
 * Le fournisseur "simulation" est celui du developpement et des tests : il
 * rejoue le cycle complet sans appeler personne.
 */

const FOURNISSEURS = { simulation, agregateur };

export function fournisseurActif() {
  const nom = process.env.PAIEMENT_FOURNISSEUR || "simulation";
  const fournisseur = FOURNISSEURS[nom];
  if (!fournisseur) {
    throw new Error(
      `Fournisseur de paiement inconnu : ${nom}. Valeurs possibles : ${Object.keys(FOURNISSEURS).join(", ")}.`,
    );
  }
  return fournisseur;
}

/** Operateurs proposes a l'auditeur au moment de payer. */
export const OPERATEURS = [
  { code: "orange", nom: "Orange Money" },
  { code: "moov", nom: "Moov Money" },
  { code: "wave", nom: "Wave" },
];

export function operateurValide(code) {
  return OPERATEURS.some((operateur) => operateur.code === code);
}

/** Un numero burkinabe : 8 chiffres, avec ou sans indicatif +226. */
export function normaliserNumero(saisie) {
  const chiffres = String(saisie || "").replace(/[^0-9]/g, "");
  const sansIndicatif = chiffres.startsWith("226") ? chiffres.slice(3) : chiffres;
  if (sansIndicatif.length !== 8) return null;
  return `+226${sansIndicatif}`;
}
