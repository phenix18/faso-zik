import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import bcrypt from "bcryptjs";

process.env.DATABASE_FILE = path.join(
  fs.mkdtempSync(path.join(os.tmpdir(), "fz-mdp-")),
  "mots-de-passe.db",
);
process.env.RESET_DUREE_MINUTES = "60";

const { getDb } = await import("@/lib/db");
const { createUser, findUserByEmail, verifyPassword } = await import("@/lib/repo/users");
const {
  creerJetonReinitialisation,
  comptePourJeton,
  appliquerReinitialisation,
  purgerJetonsExpires,
  changerMotDePasse,
} = await import("@/lib/repo/passwords");

const compte = createUser({
  name: "Awa Sawadogo",
  email: "awa@mdp.bf",
  password: "motdepasse123",
});

test("le jeton n'est jamais conserve en clair", () => {
  const { jeton } = creerJetonReinitialisation(compte.id);
  const lignes = getDb().prepare("SELECT token_hash FROM password_resets").all();

  assert.ok(lignes.length > 0);
  assert.equal(
    lignes.some((ligne) => ligne.token_hash === jeton),
    false,
    "la base ne doit contenir que l'empreinte",
  );
  assert.match(lignes[0].token_hash, /^[0-9a-f]{64}$/);
});

test("un jeton valide designe son compte, un autre ne designe rien", () => {
  const { jeton } = creerJetonReinitialisation(compte.id);

  assert.equal(comptePourJeton(jeton), compte.id);
  assert.equal(comptePourJeton("jeton-invente-de-longueur-suffisante"), null);
  assert.equal(comptePourJeton(""), null);
  assert.equal(comptePourJeton(null), null);
});

test("un nouveau lien annule le precedent", () => {
  const premier = creerJetonReinitialisation(compte.id).jeton;
  const second = creerJetonReinitialisation(compte.id).jeton;

  assert.equal(comptePourJeton(premier), null, "l'ancien courriel ne doit plus servir");
  assert.equal(comptePourJeton(second), compte.id);
});

test("le mot de passe change et le jeton ne sert qu'une fois", () => {
  const { jeton } = creerJetonReinitialisation(compte.id);

  assert.equal(appliquerReinitialisation(jeton, "nouveau-mot-de-passe"), true);
  assert.equal(verifyPassword(findUserByEmail("awa@mdp.bf"), "nouveau-mot-de-passe"), true);
  assert.equal(verifyPassword(findUserByEmail("awa@mdp.bf"), "motdepasse123"), false);

  assert.equal(
    appliquerReinitialisation(jeton, "encore-un-autre"),
    false,
    "un jeton consomme est mort",
  );
  assert.equal(verifyPassword(findUserByEmail("awa@mdp.bf"), "encore-un-autre"), false);
});

test("un jeton expire ne vaut plus rien et se purge", () => {
  const db = getDb();
  const { jeton } = creerJetonReinitialisation(compte.id);

  // On recule artificiellement l'echeance plutot que d'attendre une heure.
  db.prepare("UPDATE password_resets SET expires_at = datetime('now','-1 minute')").run();

  assert.equal(comptePourJeton(jeton), null);
  assert.equal(appliquerReinitialisation(jeton, "peu-importe"), false);
  assert.ok(purgerJetonsExpires() >= 1);
});

test("changer de mot de passe exige l'ancien", () => {
  const autre = createUser({ name: "Issa", email: "issa@mdp.bf", password: "motdepasse123" });

  assert.deepEqual(changerMotDePasse(autre.id, "mauvais", "nouveau-mot-de-passe"), {
    ok: false,
    raison: "Mot de passe actuel incorrect.",
  });
  assert.equal(verifyPassword(findUserByEmail("issa@mdp.bf"), "motdepasse123"), true);

  assert.deepEqual(changerMotDePasse(autre.id, "motdepasse123", "nouveau-mot-de-passe"), {
    ok: true,
  });
  assert.equal(verifyPassword(findUserByEmail("issa@mdp.bf"), "nouveau-mot-de-passe"), true);
});

test("le mot de passe est stocke hache, jamais en clair", () => {
  const stocke = getDb()
    .prepare("SELECT password_hash FROM users WHERE email = ?")
    .get("issa@mdp.bf").password_hash;

  assert.notEqual(stocke, "nouveau-mot-de-passe");
  assert.match(stocke, /^\$2[aby]\$/, "empreinte bcrypt attendue");
  assert.equal(bcrypt.compareSync("nouveau-mot-de-passe", stocke), true);
});

test("supprimer un compte emporte ses jetons de reinitialisation", () => {
  const ephemere = createUser({
    name: "Ephemere",
    email: "ephemere@mdp.bf",
    password: "motdepasse123",
  });
  const { jeton } = creerJetonReinitialisation(ephemere.id);
  assert.equal(comptePourJeton(jeton), ephemere.id);

  getDb().prepare("DELETE FROM users WHERE id = ?").run(ephemere.id);
  assert.equal(comptePourJeton(jeton), null);
});
