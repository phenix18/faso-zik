import { findUserById, promouvoirAdmin } from "@/lib/repo/users";
import { getArtistByUserId } from "@/lib/repo/artists";

/**
 * Ce que porte une session, et comment on l'etablit.
 *
 * Cette logique vit hors de `auth.js` pour etre verifiable : le module de
 * NextAuth n'est chargeable que par le bundler, et ce qui n'est pas testable
 * finit par deriver. `auth.js` n'est plus que le cablage.
 */

/**
 * Comptes administrateurs declares par l'environnement.
 *
 * Le role ne s'attribue par aucune page : personne ne peut se promouvoir.
 * Restait a designer le premier administrateur, ce qu'une ligne de commande ne
 * permet pas sur un hebergement sans acces au serveur.
 */
export function adressesAdmin() {
  return (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((adresse) => adresse.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Role effectif apres une authentification reussie.
 *
 * La promotion n'a lieu qu'ici, donc apres verification du mot de passe :
 * figurer sur la liste ne suffit pas, il faut aussi tenir le compte.
 */
export async function roleALaConnexion(user) {
  if (user.role === "admin") return "admin";
  if (!adressesAdmin().includes(String(user.email).toLowerCase())) return user.role;

  await promouvoirAdmin(user.id);
  return "admin";
}

/**
 * Role et fiche artiste, relus a chaque rafraichissement du jeton.
 *
 * Ils changent en cours de session — un auditeur ouvre son espace artiste, une
 * administration retire un role — et une session figee les ignorerait jusqu'a
 * la reconnexion.
 */
export async function rafraichirJeton(uid) {
  const compte = await findUserById(uid);
  const artiste = await getArtistByUserId(uid);

  // La promotion est aussi tentee ici, pas seulement a la connexion : sans
  // cela, une adresse ajoutee a ADMIN_EMAILS pendant qu'on est deja connecte
  // ne prendrait effet qu'apres une deconnexion — piege silencieux, ou l'on
  // croit la variable inoperante. La session a deja ete etablie par un mot de
  // passe verifie ; c'est le meme niveau de preuve.
  let role = compte?.role || "auditeur";
  if (compte && role !== "admin" && adressesAdmin().includes(String(compte.email).toLowerCase())) {
    await promouvoirAdmin(compte.id);
    role = "admin";
  }

  return {
    role,
    // Les parentheses comptent : `await f()?.id` applique `.id` a la promesse
    // et vaut toujours undefined. L'artiste n'etait alors jamais reconnu
    // proprietaire de ses propres titres, et ne pouvait plus les modifier.
    artistId: artiste?.id || null,
  };
}
