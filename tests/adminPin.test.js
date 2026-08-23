/**
 * Le code PIN de l'administration.
 *
 * Il ne remplace pas le mot de passe, il s'ajoute : un mot de passe vole ne
 * suffit alors plus a ouvrir la console. Le code ne figure jamais dans le
 * depot — celui-ci est public — mais dans une variable d'environnement.
 */
import test from "node:test";
import assert from "node:assert/strict";

process.env.NEXTAUTH_SECRET = "secret-de-controle";

const { pinValide, pinConfigure, signerJetonPin, jetonPinValide, COOKIE_PIN } = await import(
  "@/lib/adminPin"
);

test("sans code configure, aucune saisie ne passe", () => {
  delete process.env.ADMIN_PIN;
  assert.equal(pinConfigure(), false);
  assert.equal(pinValide(""), false);
  assert.equal(pinValide("763609"), false);
});

test("le code exact passe, un code voisin non", () => {
  process.env.ADMIN_PIN = "123456";
  assert.equal(pinConfigure(), true);
  assert.equal(pinValide("123456"), true);
  assert.equal(pinValide("123455"), false);
  assert.equal(pinValide("12345"), false);
  assert.equal(pinValide("1234567"), false);
  assert.equal(pinValide(null), false);
});

test("le jeton n'est valable que pour son compte", () => {
  const jeton = signerJetonPin("usr_a");
  assert.equal(jetonPinValide(jeton, "usr_a"), true);
  assert.equal(jetonPinValide(jeton, "usr_b"), false, "un jeton ne doit pas voyager d'un compte a l'autre");
});

test("un jeton expire ou trafique est refuse", () => {
  assert.equal(jetonPinValide(signerJetonPin("usr_a", Date.now() - 1000), "usr_a"), false);

  const jeton = signerJetonPin("usr_a");
  const [id, expire, signature] = jeton.split(".");
  // Repousser l'echeance invalide la signature.
  assert.equal(jetonPinValide(`${id}.${Number(expire) + 60000}.${signature}`, "usr_a"), false);
  // Signature bricolee.
  assert.equal(jetonPinValide(`${id}.${expire}.${"0".repeat(64)}`, "usr_a"), false);
  assert.equal(jetonPinValide("n'importe quoi", "usr_a"), false);
  assert.equal(jetonPinValide("", "usr_a"), false);
});

test("le nom du cookie est stable", () => {
  assert.equal(COOKIE_PIN, "faso_admin");
});
