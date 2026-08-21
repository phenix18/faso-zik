import test from "node:test";
import assert from "node:assert/strict";
import { clientKey, rateLimit, tooManyRequests } from "@/lib/rateLimit";

/** Chaque test travaille sur sa propre cle : le compteur est partage. */
let compteur = 0;
const cle = () => `test-${compteur++}`;

test("les appels sous la limite passent", () => {
  const k = cle();
  const options = { limit: 3, windowMs: 10_000 };
  assert.deepEqual(
    [1, 2, 3].map(() => rateLimit(k, options).allowed),
    [true, true, true],
  );
});

test("l'appel de trop est refuse, avec un delai a attendre", () => {
  const k = cle();
  const options = { limit: 2, windowMs: 10_000 };
  rateLimit(k, options);
  rateLimit(k, options);
  const refus = rateLimit(k, options);

  assert.equal(refus.allowed, false);
  assert.equal(refus.remaining, 0);
  assert.ok(refus.retryAfter > 0 && refus.retryAfter <= 10);
});

test("le decompte restant est renvoye", () => {
  const k = cle();
  const options = { limit: 3, windowMs: 10_000 };
  assert.equal(rateLimit(k, options).remaining, 2);
  assert.equal(rateLimit(k, options).remaining, 1);
  assert.equal(rateLimit(k, options).remaining, 0);
});

test("la fenetre expiree remet le compteur a zero", async () => {
  const k = cle();
  const options = { limit: 1, windowMs: 60 };
  assert.equal(rateLimit(k, options).allowed, true);
  assert.equal(rateLimit(k, options).allowed, false);

  await new Promise((resolve) => setTimeout(resolve, 90));
  assert.equal(rateLimit(k, options).allowed, true);
});

test("deux cles differentes ne se genent pas", () => {
  const options = { limit: 1, windowMs: 10_000 };
  const a = cle();
  const b = cle();
  rateLimit(a, options);
  assert.equal(rateLimit(a, options).allowed, false);
  assert.equal(rateLimit(b, options).allowed, true);
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
