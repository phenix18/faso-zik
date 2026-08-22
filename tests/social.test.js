import test from "node:test";
import assert from "node:assert/strict";


const { createUser } = await import("@/lib/repo/users");
const { getArtistByUserId } = await import("@/lib/repo/artists");
const { createTrack, recordEvent } = await import("@/lib/repo/tracks");
const { basculerAbonnement, suit, nombreAbonnes, artistesSuivis, nouveautesSuivies, classementSemaine } =
  await import("@/lib/repo/social");
const { basculerVerification, retirerTitre, vueEnsemble, derniersTitres } = await import(
  "@/lib/repo/admin"
);

async function artiste(nom, email) {
  return await getArtistByUserId(
    (await createUser({ name: nom, email, password: "motdepasse123", role: "artiste" })).id,
  );
}

const yennenga = await artiste("Yennenga Sound", "yennenga@social.bf");
const sahel = await artiste("Sahel Digital", "sahel@social.bf");
const auditeur = await createUser({ name: "Awa", email: "awa@social.bf", password: "moasync tdepasse123" });

async function deposer(artistId, titre) {
  return await createTrack({
    artistId,
    title: titre,
    kind: "audio",
    mediaPath: `audio/${titre}.mp3`,
    mediaMime: "audio/mpeg",
    mediaSize: 2048,
  });
}

/* ------------------------------ abonnements ----------------------------- */

test("l'abonnement bascule dans les deux sens", async () => {
  assert.equal(await suit(auditeur.id, yennenga.id), false);
  assert.equal(await basculerAbonnement(auditeur.id, yennenga.id), true);
  assert.equal(await suit(auditeur.id, yennenga.id), true);
  assert.equal(await nombreAbonnes(yennenga.id), 1);

  assert.equal(await basculerAbonnement(auditeur.id, yennenga.id), false);
  assert.equal(await nombreAbonnes(yennenga.id), 0);
});

test("un visiteur sans compte ne suit personne", async () => {
  assert.equal(await suit(null, yennenga.id), false);
  assert.equal(await suit(undefined, yennenga.id), false);
});

test("les nouveautes ne montrent que les artistes suivis", async () => {
  await basculerAbonnement(auditeur.id, yennenga.id);
  await deposer(yennenga.id, "Suivi");
  await deposer(sahel.id, "Non suivi");

  const titres = (await nouveautesSuivies(auditeur.id)).map((t) => t.title);
  assert.ok(titres.includes("Suivi"));
  assert.equal(titres.includes("Non suivi"), false);
  assert.deepEqual(
    (await artistesSuivis(auditeur.id)).map((a) => a.name),
    ["Yennenga Sound"],
  );
});

/* ------------------------------- classement ----------------------------- */

test("le classement repose sur les ecoutes recentes, pas sur le cumul", async () => {
  const ancien = await deposer(yennenga.id, "Ancien succes");
  const recent = await deposer(sahel.id, "Sortie de la semaine");

  // Ecoutes datees de la semaine pour le titre recent seulement.
  for (let index = 0; index < 5; index += 1) await recordEvent(recent.id, "play");
  await recordEvent(ancien.id, "play");

  const classement = await classementSemaine(10);
  assert.equal(classement[0].title, "Sortie de la semaine");
  assert.equal(classement[0].ecoutesSemaine, 5);
});

test("un titre retire sort du classement", async () => {
  const titre = await deposer(sahel.id, "A retirer");
  for (let index = 0; index < 20; index += 1) await recordEvent(titre.id, "play");
  assert.equal((await classementSemaine(10))[0].title, "A retirer");

  await retirerTitre(titre.id);
  assert.equal(
    (await classementSemaine(10)).some((t) => t.title === "A retirer"),
    false,
  );
});

/* ----------------------------- administration --------------------------- */

test("la verification d'un artiste bascule", async () => {
  assert.equal(await basculerVerification(sahel.id), true);
  assert.equal(await basculerVerification(sahel.id), false);
  assert.equal(await basculerVerification("art_inexistant"), null);
});

test("le retrait depublie sans effacer le fichier", async () => {
  const { getTrackRow } = await import("@/lib/repo/tracks");
  const titre = await deposer(yennenga.id, "Reclamation");

  await retirerTitre(titre.id);
  const ligne = await getTrackRow(titre.id);

  assert.equal(ligne.published, false, "le titre est depublie, pas efface");
  assert.ok(ligne.media_path, "le chemin du fichier est conserve");
});

test("la vue d'ensemble compte ce qui existe", async () => {
  const resume = await vueEnsemble();
  assert.ok(resume.artistes >= 2);
  assert.ok(resume.titres >= 5);
  assert.ok(resume.titresEnLigne < resume.titres, "les titres retires sont deduits");
  assert.ok(resume.ecoutes7j > 0);
  assert.ok((await derniersTitres(5)).length <= 5);
});
