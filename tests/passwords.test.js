import test from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";

process.env.RESET_DUREE_MINUTES = "60";

const { query, execute, unique } = await import("@/lib/db");
const { createUser, findUserByEmail, verifyPassword } = await import("@/lib/repo/users");
const {
  creerJetonReinitialisation,
  comptePourJeton,
  appliquerReinitialisation,
  purgerJetonsExpires,
  changerMotDePasse,
} = await import("@/lib/repo/passwords");

const compte = await createUser({
  name: "Awa Sawadogo",
  email: "awa@mdp.bf",
  password: "motdepasse123",
});

test("le jeton n'est jamais conserve en clair", async () => {
  const { jeton } = await creerJetonReinitialisation(compte.id);
  const lignes = await query("SELECT token_hash FROM password_resets");

  assert.ok(lignes.length > 0);
  assert.equal(
    lignes.some((ligne) => ligne.token_hash === jeton),
    false,
    "la base ne doit contenir que l'empreinte",
  );
  assert.match(lignes[0].token_hash, /^[0-9a-f]{64}$/);
});

test("un jeton valide designe son compte, un autre ne designe rien", async () => {
  const { jeton } = await creerJetonReinitialisation(compte.id);

  assert.equal(await comptePourJeton(jeton), compte.id);
  assert.equal(await comptePourJeton("jeton-invente-de-longueur-suffisante"), null);
  assert.equal(await comptePourJeton(""), null);
  assert.equal(await comptePourJeton(null), null);
});

test("un nouveau lien annule le precedent", async () => {
  const premier = (await creerJetonReinitialisation(compte.id)).jeton;
  const second = (await creerJetonReinitialisation(compte.id)).jeton;

  assert.equal(await comptePourJeton(premier), null, "l'ancien courriel ne doit plus servir");
  assert.equal(await comptePourJeton(second), compte.id);
});

test("le mot de passe change et le jeton ne sert qu'une fois", async () => {
  const { jeton } = await creerJetonReinitialisation(compte.id);

  assert.equal(await appliquerReinitialisation(jeton, "nouveau-mot-de-passe"), true);
  assert.equal(verifyPassword(await findUserByEmail("awa@mdp.bf"), "nouveau-mot-de-passe"), true);
  assert.equal(verifyPassword(await findUserByEmail("awa@mdp.bf"), "motdepasse123"), false);

  assert.equal(
    await appliquerReinitialisation(jeton, "encore-un-autre"),
    false,
    "un jeton consomme est mort",
  );
  assert.equal(verifyPassword(await findUserByEmail("awa@mdp.bf"), "encore-un-autre"), false);
});

test("un jeton expire ne vaut plus rien et se purge", async () => {
    const { jeton } = await creerJetonReinitialisation(compte.id);

  // On recule artificiellement l'echeance plutot que d'attendre une heure.
  await execute("UPDATE password_resets SET expires_at = now() - interval '1 minute'");

  assert.equal(await comptePourJeton(jeton), null);
  assert.equal(await appliquerReinitialisation(jeton, "peu-importe"), false);
  assert.ok(await purgerJetonsExpires() >= 1);
});

test("changer de mot de passe exige l'ancien", async () => {
  const autre = await createUser({ name: "Issa", email: "issa@mdp.bf", password: "motdepasse123" });

  assert.deepEqual(await changerMotDePasse(autre.id, "mauvais", "nouveau-mot-de-passe"), {
    ok: false,
    raison: "Mot de passe actuel incorrect.",
  });
  assert.equal(verifyPassword(await findUserByEmail("issa@mdp.bf"), "motdepasse123"), true);

  assert.deepEqual(await changerMotDePasse(autre.id, "motdepasse123", "nouveau-mot-de-passe"), {
    ok: true,
  });
  assert.equal(verifyPassword(await findUserByEmail("issa@mdp.bf"), "nouveau-mot-de-passe"), true);
});

test("le mot de passe est stocke hache, jamais en clair", async () => {
  const stocke = (await unique("SELECT password_hash FROM users WHERE email = $1", ["issa@mdp.bf"])).password_hash;

  assert.notEqual(stocke, "nouveau-mot-de-passe");
  assert.match(stocke, /^\$2[aby]\$/, "empreinte bcrypt attendue");
  assert.equal(bcrypt.compareSync("nouveau-mot-de-passe", stocke), true);
});

test("supprimer un compte emporte ses jetons de reinitialisation", async () => {
  const ephemere = await createUser({
    name: "Ephemere",
    email: "ephemere@mdp.bf",
    password: "motdepasse123",
  });
  const { jeton } = await creerJetonReinitialisation(ephemere.id);
  assert.equal(await comptePourJeton(jeton), ephemere.id);

  await execute("DELETE FROM users WHERE id = $1", [ephemere.id]);
  assert.equal(await comptePourJeton(jeton), null);
});
