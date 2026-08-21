import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { getDb } from "@/lib/db";

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

export function creerJetonReinitialisation(userId) {
  const db = getDb();
  const jeton = crypto.randomBytes(32).toString("base64url");

  // Un nouveau lien annule les precedents : sinon un ancien courriel resterait
  // valable apres coup.
  db.prepare("DELETE FROM password_resets WHERE user_id = ?").run(userId);
  db.prepare(
    `INSERT INTO password_resets (token_hash, user_id, expires_at)
     VALUES (?, ?, datetime('now', ?))`,
  ).run(empreinte(jeton), userId, `+${DUREE_MINUTES} minutes`);

  return { jeton, dureeMinutes: DUREE_MINUTES };
}

/** @returns l'identifiant du compte, ou null si le jeton ne vaut plus rien. */
export function comptePourJeton(jeton) {
  const ligne = getDb()
    .prepare(
      `SELECT user_id FROM password_resets
        WHERE token_hash = ? AND used_at IS NULL AND expires_at > datetime('now')`,
    )
    .get(empreinte(jeton || ""));

  return ligne?.user_id || null;
}

/**
 * Change le mot de passe et consomme le jeton dans la meme transaction : deux
 * demandes simultanees ne peuvent pas l'utiliser deux fois.
 */
export function appliquerReinitialisation(jeton, motDePasse) {
  const db = getDb();
  const userId = comptePourJeton(jeton);
  if (!userId) return false;

  db.transaction(() => {
    db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(
      bcrypt.hashSync(motDePasse, 10),
      userId,
    );
    db.prepare("UPDATE password_resets SET used_at = datetime('now') WHERE token_hash = ?").run(
      empreinte(jeton),
    );
  })();

  return true;
}

/** Purge des jetons perimes : ils n'ont plus aucune utilite. */
export function purgerJetonsExpires() {
  return getDb()
    .prepare("DELETE FROM password_resets WHERE expires_at <= datetime('now')")
    .run().changes;
}

/** Changement de mot de passe par un compte connecte, ancien mot de passe exige. */
export function changerMotDePasse(userId, ancien, nouveau) {
  const db = getDb();
  const compte = db.prepare("SELECT password_hash FROM users WHERE id = ?").get(userId);
  if (!compte) return { ok: false, raison: "Compte introuvable." };
  if (!compte.password_hash || !bcrypt.compareSync(ancien, compte.password_hash)) {
    return { ok: false, raison: "Mot de passe actuel incorrect." };
  }

  db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(
    bcrypt.hashSync(nouveau, 10),
    userId,
  );
  return { ok: true };
}
