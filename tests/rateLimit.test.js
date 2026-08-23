import test from "node:test";
import assert from "node:assert/strict";
import { clientKey, rateLimit, tooManyRequests } from "@/lib/rateLimit";

/** Chaque test travaille sur sa propre cle : le compteur est partage. */
let compteur = 0;
const cle = () => `test-${compteur++}`;

test("les appels sous la limite passent", async () => {
  const k = cle();
  const options = { limit: 3, windowMs: 10_000 };
  const resultats = [];
  for (let index = 0; index < 3; index += 1) {
    resultats.push((await rateLimit(k, options)).allowed);
  }
  assert.deepEqual(resultats, [true, true, true]);
});

test("l'appel de trop est refuse, avec un delai a attendre", async () => {
  const k = cle();
  const options = { limit: 2, windowMs: 10_000 };
  await rateLimit(k, options);
  await rateLimit(k, options);
  const refus = await rateLimit(k, options);

  assert.equal(refus.allowed, false);
  assert.equal(refus.remaining, 0);
  assert.ok(refus.retryAfter > 0 && refus.retryAfter <= 10);
});

test("le decompte restant est renvoye", async () => {
  const k = cle();
  const options = { limit: 3, windowMs: 10_000 };
  assert.equal((await rateLimit(k, options)).remaining, 2);
  assert.equal((await rateLimit(k, options)).remaining, 1);
  assert.equal((await rateLimit(k, options)).remaining, 0);
});

test("la fenetre expiree remet le compteur a zero", async () => {
  const k = cle();
  const options = { limit: 1, windowMs: 1000 };
  assert.equal((await rateLimit(k, options)).allowed, true);
  assert.equal((await rateLimit(k, options)).allowed, false);

  await new Promise((resoudre) => setTimeout(resoudre, 1300));
  assert.equal((await rateLimit(k, options)).allowed, true);
});

test("deux cles differentes ne se genent pas", async () => {
  const options = { limit: 1, windowMs: 10_000 };
  const a = cle();
  const b = cle();
  await rateLimit(a, options);

  assert.equal((await rateLimit(a, options)).allowed, false);
  assert.equal((await rateLimit(b, options)).allowed, true);
});

test("le compteur tient entre deux appels : c'est le point de la table", async () => {
  // En memoire, deux instances auraient chacune le sien et la limite serait
  // multipliee par leur nombre.
  const k = cle();
  const options = { limit: 5, windowMs: 10_000 };
  for (let index = 0; index < 5; index += 1) await rateLimit(k, options);

  const { execute } = await import("@/lib/db");
  const efface = await execute("DELETE FROM rate_limits WHERE cle = $1 AND compte >= 5", [k]);
  assert.equal(efface, 1, "le compte a bien ete enregistre en base");
});

test("l'adresse retenue est le premier maillon de x-forwarded-for", () => {
  const requete = new Request("https://faso-zik.bf/api/upload", {
    headers: { "x-forwarded-for": "41.203.0.10, 10.0.0.1, 172.16.0.9" },
  });
  assert.equal(clientKey(requete, "upload"), "upload:41.203.0.10");
});

test("x-real-ip sert de repli, puis une valeur par defaut", () => {
  const avecReal = new Request("https://faso-zik.bf/", {
    headers: { "x-real-ip": "41.203.0.20" },
  });
  assert.equal(clientKey(avecReal, "auth"), "auth:41.203.0.20");
  assert.equal(clientKey(new Request("https://faso-zik.bf/"), "auth"), "auth:inconnu");
});

test("la portee separe les compteurs d'une meme adresse", () => {
  const requete = new Request("https://faso-zik.bf/", {
    headers: { "x-forwarded-for": "41.203.0.30" },
  });
  assert.notEqual(clientKey(requete, "upload"), clientKey(requete, "register"));
});

test("le refus porte l'en-tete Retry-After", async () => {
  const reponse = tooManyRequests(42);
  assert.equal(reponse.status, 429);
  assert.equal(reponse.headers.get("retry-after"), "42");
  assert.match((await reponse.json()).error, /42 secondes/);
});
