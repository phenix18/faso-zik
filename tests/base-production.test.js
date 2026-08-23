/**
 * En production, une base en memoire est pire qu'une panne : chaque instance
 * ouvrirait la sienne, vide, et le site perdrait comptes et catalogue a chaque
 * requete sans rien signaler.
 */
import test from "node:test";
import assert from "node:assert/strict";

process.env.NODE_ENV = "production";
delete process.env.DATABASE_URL;
delete process.env.PGLITE_EN_PRODUCTION;

const { getDb } = await import("@/lib/db");

test("en production, l'absence de DATABASE_URL est un refus franc", async () => {
  await assert.rejects(() => getDb(), /DATABASE_URL absent/);
  // Deux fois : un echec ne doit pas rester en memoire et condamner l'instance.
  await assert.rejects(() => getDb(), /DATABASE_URL absent/);
});

test("le repli reste possible sur un site de demonstration assume", async () => {
  process.env.PGLITE_EN_PRODUCTION = "oui";
  const db = await getDb();
  assert.equal(db.type, "pglite");

  const { fermerDb } = await import("@/lib/db");
  await fermerDb();
  delete process.env.PGLITE_EN_PRODUCTION;
});
