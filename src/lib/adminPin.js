import crypto from "node:crypto";

/**
 * Second facteur de l'espace d'administration.
 *
 * Le mot de passe d'un compte peut fuiter — reutilise ailleurs, lu dans un
 * gestionnaire mal ferme, arrache par hameconnage. Un code court, connu du
 * seul exploitant et jamais ecrit dans le depot, ajoute une porte que ce vol
 * ne suffit pas a ouvrir. Il ne remplace pas le mot de passe : il s'ajoute.
 *
 * Le code vit dans ADMIN_PIN, cote serveur uniquement. Aucune page ne le
 * renvoie, aucun journal ne l'imprime, et le depot ne le contient pas — ce
 * depot est public.
 */

export function pinConfigure() {
  return !!(process.env.ADMIN_PIN || "").trim();
}

/**
 * Comparaison en temps constant.
 *
 * Un `===` sort au premier caractere different : le temps de reponse trahit
 * alors combien de caracteres sont bons, et un code a six chiffres tombe en
 * quelques milliers d'essais. On compare des empreintes de meme longueur.
 */
export function pinValide(saisie) {
  const attendu = (process.env.ADMIN_PIN || "").trim();
  if (!attendu) return false;

  const a = crypto.createHash("sha256").update(String(saisie || "")).digest();
  const b = crypto.createHash("sha256").update(attendu).digest();
  return crypto.timingSafeEqual(a, b);
}

/**
 * Jeton remis apres un code valide, a poser en cookie.
 *
 * Il est signe avec le secret des sessions et porte l'identifiant du compte :
 * un jeton vole ne sert donc a rien sur un autre compte. Sa duree est courte —
 * une console d'administration laissee ouverte est un risque en soi.
 */
const DUREE_MS = 8 * 60 * 60 * 1000;

function secret() {
  const valeur = process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET;
  if (!valeur) throw new Error("NEXTAUTH_SECRET manquant : impossible de signer le jeton.");
  return valeur;
}

export function signerJetonPin(userId, expireA = Date.now() + DUREE_MS) {
  const charge = `${userId}.${expireA}`;
  const signature = crypto.createHmac("sha256", secret()).update(charge).digest("hex");
  return `${charge}.${signature}`;
}

export function jetonPinValide(jeton, userId) {
  const morceaux = String(jeton || "").split(".");
  if (morceaux.length !== 3) return false;

  const [id, expireA, signature] = morceaux;
  if (id !== userId) return false;
  if (!Number(expireA) || Number(expireA) < Date.now()) return false;

  const attendue = crypto
    .createHmac("sha256", secret())
    .update(`${id}.${expireA}`)
    .digest("hex");
  const a = Buffer.from(signature, "hex");
  const b = Buffer.from(attendue, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export const COOKIE_PIN = "faso_admin";
