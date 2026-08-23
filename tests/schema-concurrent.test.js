/**
 * Deux instances qui demarrent en meme temps.
 *
 * Sur une plateforme sans serveur, la premiere vague de trafic reveille
 * plusieurs instances a la seconde pres et chacune applique le schema. En
 * production, cela s'est vu : `duplicate key value violates unique constraint
 * "pg_type_typname_nsp_index"`, deux instances se disputant la ligne de
 * catalogue de la table users. `CREATE TABLE IF NOT EXISTS` n'est pas atomique
 * face a un createur concurrent.
 */
import test from "node:test";
import assert from "node:assert/strict";

const { getDb, query, _estCollisionDeCreation } = await import("@/lib/db");

test("une collision de creation est reconnue, une vraie erreur non", () => {
  // Unicite du catalogue, relation deja presente, objet duplique.
  for (const code of ["23505", "42P07", "42710"]) {
    assert.equal(_estCollisionDeCreation({ code }), true, code);
  }
  // Une faute de syntaxe ou une panne de connexion doit continuer de remonter.
  for (const code of ["42601", "08006", undefined]) {
    assert.equal(_estCollisionDeCreation({ code }), false, String(code));
  }
  assert.equal(_estCollisionDeCreation(null), false);
});

test("plusieurs ouvertures simultanees donnent une seule base utilisable", async () => {
  const bases = await Promise.all([getDb(), getDb(), getDb(), getDb()]);
  assert.equal(new Set(bases).size, 1, "chaque appel doit rendre la meme connexion");

  const [{ n }] = await query(
    "SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema = 'public'",
  );
  assert.ok(n >= 13, `schema incomplet : ${n} tables`);
});

test("reappliquer le schema ne casse rien", async () => {
  const { schema } = await import("@/lib/db/schema");
  const base = await getDb();
  // Tout y est conditionnel : une seconde passe doit etre sans effet.
  await base.exec(schema);

  const [{ n }] = await query("SELECT count(*)::int AS n FROM users");
  assert.equal(typeof n, "number");
});
