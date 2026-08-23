/**
 * Adaptateur S3 : signature verifiee hors ligne.
 *
 * Une adresse signee se fabrique sans appeler le stockage — c'est du calcul
 * local. On peut donc verifier la forme exacte de ce qui sera remis au
 * navigateur sans compte chez personne.
 */
import test from "node:test";
import assert from "node:assert/strict";

process.env.STOCKAGE_FOURNISSEUR = "s3";
process.env.S3_ENDPOINT = "https://exemple.r2.cloudflarestorage.com";
process.env.S3_BUCKET = "faso-zik-controle";
process.env.S3_ACCESS_KEY_ID = "cle-de-controle";
process.env.S3_SECRET_ACCESS_KEY = "secret-de-controle";

const { FOURNISSEUR, adresseDeDepot, adresseDeLecture, stockageConfigure } = await import(
  "@/lib/storage"
);

test("les identifiants S3 suffisent a basculer de fournisseur", () => {
  assert.equal(FOURNISSEUR, "s3");
  assert.equal(stockageConfigure(), true);
});

test("l'adresse d'envoi vise le seau et porte une signature bornee dans le temps", async () => {
  const { chemin, url } = await adresseDeDepot({
    kind: "audio",
    mime: "audio/mpeg",
    taille: 3 * 1024 * 1024,
    nom: "morceau.mp3",
  });

  assert.match(chemin, /^audio\/[A-Za-z0-9._-]+\.mp3$/);

  const adresse = new URL(url);
  assert.equal(adresse.host, "exemple.r2.cloudflarestorage.com");
  assert.equal(adresse.pathname, `/faso-zik-controle/${chemin}`);
  assert.ok(adresse.searchParams.get("X-Amz-Signature"), "adresse non signee");
  assert.equal(adresse.searchParams.get("X-Amz-Expires"), "900");
});

test("un type refuse ne produit aucune adresse", async () => {
  await assert.rejects(
    () => adresseDeDepot({ kind: "audio", mime: "application/x-msdownload", taille: 1024 }),
    /Format non accepte/,
  );
  await assert.rejects(
    () => adresseDeDepot({ kind: "audio", mime: "audio/mpeg", taille: 500 * 1024 * 1024 }),
    /trop volumineux/,
  );
});

test("l'adresse de lecture propose le nom de fichier, guillemets retires", async () => {
  const url = await adresseDeLecture("audio/abc.mp3", {
    telechargement: 'Yennenga "Sound" - Titre.mp3',
  });

  const disposition = new URL(url).searchParams.get("response-content-disposition");
  // Un guillemet non retire fermerait l'en-tete par le milieu.
  assert.equal(disposition, 'attachment; filename="Yennenga Sound - Titre.mp3"');
  assert.equal(new URL(url).searchParams.get("X-Amz-Expires"), "300");
});

test("sans nom de fichier, aucune disposition n'est imposee", async () => {
  const url = await adresseDeLecture("audio/abc.mp3");
  assert.equal(new URL(url).searchParams.get("response-content-disposition"), null);
});
