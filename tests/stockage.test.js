import test from "node:test";
import assert from "node:assert/strict";
import {
  cheminDepuisAdresse,
  cheminValide,
  exigerChemin,
  extensionFor,
  nettoyerObjets,
  stockageConfigure,
  verifierDepot,
} from "@/lib/storage";

test("un chemin d'objet valide suit la forme attendue", () => {
  assert.equal(cheminValide("audio/abc123.mp3"), true);
  assert.equal(cheminValide("image/pochette-1.jpg"), true);
  assert.equal(cheminValide("preview/x.mp3"), true);
});

test("toute forme de traversee ou de dossier inconnu est refusee", () => {
  for (const chemin of [
    "../secret",
    "audio/../../etc/passwd",
    "/etc/passwd",
    "audio/sous/dossier.mp3",
    "inconnu/x.mp3",
    "audio/",
    "",
    null,
  ]) {
    assert.equal(cheminValide(chemin), false, `${chemin} aurait du etre refuse`);
  }
  assert.throws(() => exigerChemin("../secret"), /invalide/);
});

test("l'extension suit le type declare, sinon le nom du fichier", () => {
  assert.equal(extensionFor("audio/mpeg"), ".mp3");
  assert.equal(extensionFor("video/mp4"), ".mp4");
  assert.equal(extensionFor("application/inconnu", "morceau.opus"), ".opus");
  assert.equal(extensionFor("application/inconnu"), ".bin");
});

test("un type non accepte est refuse avant tout envoi", () => {
  assert.throws(
    () => verifierDepot({ kind: "audio", mime: "application/x-msdownload", taille: 16 }),
    /Format non accepte/,
  );
  assert.throws(
    () => verifierDepot({ kind: "audio", mime: "video/mp4", taille: 16 }),
    /Format non accepte/,
    "une video deposee comme audio est refusee",
  );
  assert.throws(() => verifierDepot({ kind: "inconnu", mime: "audio/mpeg", taille: 16 }), /inconnu/);
});

test("un fichier au-dela de la limite est refuse", () => {
  assert.doesNotThrow(() =>
    verifierDepot({ kind: "audio", mime: "audio/mpeg", taille: 5 * 1024 * 1024 }),
  );
  assert.throws(
    () => verifierDepot({ kind: "audio", mime: "audio/mpeg", taille: 500 * 1024 * 1024 }),
    /trop volumineux/,
  );
});

test("le chemin d'une pochette se retrouve depuis son adresse", () => {
  assert.equal(cheminDepuisAdresse("/api/asset/image/pochette-1.jpg"), "image/pochette-1.jpg");
  // Une pochette hebergee ailleurs n'appartient pas au stockage : rien a effacer.
  assert.equal(cheminDepuisAdresse("https://exemple.bf/pochette.jpg"), null);
  assert.equal(cheminDepuisAdresse("/api/asset/../../etc/passwd"), null);
  assert.equal(cheminDepuisAdresse(null), null);
});

test("un nettoyage impossible ne fait pas echouer la suppression", { skip: stockageConfigure() }, async () => {
  // Sans stockage configure, l'appel echoue. Les lignes sont deja parties de la
  // base : signaler un echec ferait recommencer l'appelant dans le vide.
  const erreurs = [];
  const journal = console.error;
  console.error = (...args) => erreurs.push(args.join(" "));
  try {
    assert.equal(await nettoyerObjets(["audio/orphelin.mp3"]), false);
  } finally {
    console.error = journal;
  }
  assert.match(erreurs.join(" "), /Nettoyage du stockage impossible/);
});
