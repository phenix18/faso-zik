import test from "node:test";
import assert from "node:assert/strict";
import { newId, slugify } from "@/lib/ids";

test("les accents et la ponctuation disparaissent du slug", () => {
  assert.equal(slugify("Yennenga Étoile du Faso !"), "yennenga-etoile-du-faso");
  assert.equal(slugify("Coupé-Décalé"), "coupe-decale");
  assert.equal(slugify("  Ouaga   la   Nuit  "), "ouaga-la-nuit");
});

test("un titre sans caractere exploitable garde un slug utilisable", () => {
  assert.equal(slugify("???"), "sans-titre");
  assert.equal(slugify(""), "sans-titre");
  assert.equal(slugify(null), "sans-titre");
});

test("le slug est borne en longueur", () => {
  assert.ok(slugify("a".repeat(300)).length <= 80);
});

test("les identifiants sont prefixes et uniques", () => {
  const identifiant = newId("trk");
  assert.match(identifiant, /^trk_[0-9a-f]{20}$/);

  const lot = new Set(Array.from({ length: 500 }, () => newId()));
  assert.equal(lot.size, 500);
});
