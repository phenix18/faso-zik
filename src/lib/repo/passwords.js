import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { execute, transaction, unique } from "@/lib/db";

/**
 * Reinitialisation de mot de passe.
 *
 * Le jeton n'est jamais conserve en clair : la base ne garde que son
 * empreinte. Une copie de la base derobee ne permet donc pas de prendre la
 * main sur les comptes.
 */

const DUREE_MINUTES = Number(process.env.RESET_DUREE_MINUTES || 60);

function empreinte(jeton) {
  return crypto.createHash("sha256").update(jeton).digest("hex");
}

export async function creerJetonReinitialisation(userId) {
  const jeton = crypto.randomBytes(32).toString("base64url");

  await transaction(async (q) => {
    // Un nouveau lien annule les precedents : sinon un ancien courriel
    // resterait valable apres coup.
    await q("DELETE FROM password_resets WHERE user_id = $1", [userId]);
    await q(
      `INSERT INTO password_resets (token_hash, user_id, expires_at)
       VALUES ($1, $2, now() + ($3 || ' minutes')::interval)`,
      [empreinte(jeton), userId, String(DUREE_MINUTES)],
    );
  });

  return { jeton, dureeMinutes: DUREE_MINUTES };
}

/** @returns l'identifiant du compte, ou null si le jeton ne vaut plus rien. */
export async function comptePourJeton(jeton) {
  if (!jeton) return null;

  const ligne = await unique(
    `SELECT user_id FROM password_resets
      WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now()`,
    [empreinte(jeton)],
  );
  return ligne?.user_id || null;
}

/**
 * Change le mot de passe et consomme le jeton dans la meme transaction : deux
 * demandes simultanees ne peuvent pas l'utiliser deux fois.
 */
export async function appliquerReinitialisation(jeton, motDePasse) {
  const userId = await comptePourJeton(jeton);
  if (!userId) return false;

  const hash = bcrypt.hashSync(motDePasse, 10);
  let applique = false;

  await transaction(async (q) => {
    // La condition sur used_at est dans l'ecriture : c'est elle qui garantit
    // qu'un seul appel l'emporte.
    const marque = await q(
      "UPDATE password_resets SET used_at = now() WHERE token_hash = $1 AND used_at IS NULL",
      [empreinte(jeton)],
    );
    const touchees = marque.count ?? marque.length ?? 0;
    if (!touchees) return;

    await q("UPDATE users SET password_hash = $1 WHERE id = $2", [hash, userId]);
    applique = true;
  });

  return applique;
}

/** Purge des jetons perimes : ils n'ont plus aucune utilite. */
export async function purgerJetonsExpires() {
  return execute("DELETE FROM password_resets WHERE expires_at <= now()");
}

/** Changement de mot de passe par un compte connecte, ancien mot de passe exige. */
export async function changerMotDePasse(userId, ancien, nouveau) {
  const compte = await unique("SELECT password_hash FROM users WHERE id = $1", [userId]);
  if (!compte) return { ok: false, raison: "Compte introuvable." };
  if (!compte.password_hash || !bcrypt.compareSync(ancien, compte.password_hash)) {
    return { ok: false, raison: "Mot de passe actuel incorrect." };
  }

  await execute("UPDATE users SET password_hash = $1 WHERE id = $2", [
    bcrypt.hashSync(nouveau, 10),
    userId,
  ]);
  return { ok: true };
}
