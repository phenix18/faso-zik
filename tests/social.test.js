import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

process.env.DATABASE_FILE = path.join(
  fs.mkdtempSync(path.join(os.tmpdir(), "fz-social-")),
  "social.db",
);

const { createUser } = await import("@/lib/repo/users");
const { getArtistByUserId } = await import("@/lib/repo/artists");
const { createTrack, recordEvent } = await import("@/lib/repo/tracks");
const { basculerAbonnement, suit, nombreAbonnes, artistesSuivis, nouveautesSuivies, classementSemaine } =
  await import("@/lib/repo/social");
const { basculerVerification, retirerTitre, vueEnsemble, derniersTitres } = await import(
  "@/lib/repo/admin"
);

function artiste(nom, email) {
  return getArtistByUserId(
    createUser({ name: nom, email, password: "motdepasse123", role: "artiste" }).id,
  );
}

const yennenga = artiste("Yennenga Sound", "yennenga@social.bf");
const sahel = artiste("Sahel Digital", "sahel@social.bf");
const auditeur = createUser({ name: "Awa", email: "awa@social.bf", password: "motdepasse123" });

function deposer(artistId, titre) {
  return createTrack({
    artistId,
    title: titre,
    kind: "audio",
    mediaPath: `audio/${titre}.mp3`,
    mediaMime: "audio/mpeg",
    mediaSize: 2048,
  });
}

/* ------------------------------ abonnements ----------------------------- */

test("l'abonnement bascule dans les deux sens", () => {
  assert.equal(suit(auditeur.id, yennenga.id), false);
  assert.equal(basculerAbonnement(auditeur.id, yennenga.id), true);
  assert.equal(suit(auditeur.id, yennenga.id), true);
  assert.equal(nombreAbonnes(yennenga.id), 1);

  assert.equal(basculerAbonnement(auditeur.id, yennenga.id), false);
  assert.equal(nombreAbonnes(yennenga.id), 0);
});

test("un visiteur sans compte ne suit personne", () => {
  assert.equal(suit(null, yennenga.id), false);
  assert.equal(suit(undefined, yennenga.id), false);
});

test("les nouveautes ne montrent que les artistes suivis", () => {
  basculerAbonnement(auditeur.id, yennenga.id);
  deposer(yennenga.id, "Suivi");
  deposer(sahel.id, "Non suivi");

  const titres = nouveautesSuivies(auditeur.id).map((t) => t.title);
  assert.ok(titres.includes("Suivi"));
  assert.equal(titres.includes("Non suivi"), false);
  assert.deepEqual(
    artistesSuivis(auditeur.id).map((a) => a.name),
    ["Yennenga Sound"],
  );
});

/* ------------------------------- classement ----------------------------- */

test("le classement repose sur les ecoutes recentes, pas sur le cumul", () => {
  const ancien = deposer(yennenga.id, "Ancien succes");
  const recent = deposer(sahel.id, "Sortie de la semaine");

  // Ecoutes datees de la semaine pour le titre recent seulement.
  for (let index = 0; index < 5; index += 1) recordEvent(recent.id, "play");
  recordEvent(ancien.id, "play");

  const classement = classementSemaine(10);
  assert.equal(classement[0].title, "Sortie de la semaine");
  assert.equal(classement[0].ecoutesSemaine, 5);
});

test("un titre retire sort du classement", () => {
  const titre = deposer(sahel.id, "A retirer");
  for (let index = 0; index < 20; index += 1) recordEvent(titre.id, "play");
  assert.equal(classementSemaine(10)[0].title, "A retirer");

  retirerTitre(titre.id);
  assert.equal(
    classementSemaine(10).some((t) => t.title === "A retirer"),
    false,
  );
});

/* ----------------------------- administration --------------------------- */

test("la verification d'un artiste bascule", () => {
  assert.equal(basculerVerification(sahel.id), true);
  assert.equal(basculerVerification(sahel.id), false);
  assert.equal(basculerVerification("art_inexistant"), null);
});

test("le retrait depublie sans effacer le fichier", async () => {
  const { getTrackRow } = await import("@/lib/repo/tracks");
  const titre = deposer(yennenga.id, "Reclamation");

  retirerTitre(titre.id);
  const ligne = getTrackRow(titre.id);

  assert.equal(ligne.published, 0);
  assert.ok(ligne.media_path, "le chemin du fichier est conserve");
});

test("la vue d'ensemble compte ce qui existe", () => {
  const resume = vueEnsemble();
  assert.ok(resume.artistes >= 2);
  assert.ok(resume.titres >= 5);
  assert.ok(resume.titresEnLigne < resume.titres, "les titres retires sont deduits");
  assert.ok(resume.ecoutes7j > 0);
  assert.ok(derniersTitres(5).length <= 5);
});
