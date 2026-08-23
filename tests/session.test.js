/**
 * Ce que la session porte reellement.
 *
 * Le rappel `jwt` relit le role et la fiche artiste a chaque rafraichissement.
 * Une paire de parentheses manquante y appliquait `.id` a la promesse au lieu
 * du resultat : `artistId` valait toujours null, et un artiste n'etait donc
 * jamais reconnu proprietaire de ses propres titres — il ne pouvait plus les
 * modifier ni les retirer.
 */
import test from "node:test";
import assert from "node:assert/strict";

const { rafraichirJeton, roleALaConnexion, adressesAdmin } = await import("@/lib/session");
const { createUser, promoteToArtist } = await import("@/lib/repo/users");
const { getArtistByUserId } = await import("@/lib/repo/artists");
const { createTrack } = await import("@/lib/repo/tracks");
const { ownsTrack } = await import("@/lib/permissions");
const { getTrackRow } = await import("@/lib/repo/tracks");

test("la session d'un artiste porte l'identifiant de sa fiche", async () => {
  const compte = await createUser({
    name: "Yennenga",
    email: "session-artiste@exemple.bf",
    password: "motdepasse12",
  });
  await promoteToArtist(compte.id, { stageName: "Yennenga Sound" });
  const artiste = await getArtistByUserId(compte.id);

  const jeton = await rafraichirJeton(compte.id);
  assert.equal(jeton.artistId, artiste.id, "l'identifiant d'artiste manque a la session");
  assert.equal(jeton.role, "artiste");

  const user = { id: compte.id, role: jeton.role, artistId: jeton.artistId };

  // La consequence concrete : l'artiste est proprietaire de ses titres.
  const titre = await createTrack({
    artistId: artiste.id,
    title: "Mon titre",
    kind: "audio",
    mediaPath: "audio/session.mp3",
    mediaMime: "audio/mpeg",
    mediaSize: 1024,
  });
  assert.equal(ownsTrack(user, await getTrackRow(titre.id)), true);
});

test("un auditeur n'a pas de fiche artiste", async () => {
  const compte = await createUser({
    name: "Auditeur",
    email: "session-auditeur@exemple.bf",
    password: "motdepasse12",
  });

  const jeton = await rafraichirJeton(compte.id);
  assert.equal(jeton.artistId, null);
  assert.equal(jeton.role, "auditeur");
});

test("une adresse declaree administrateur obtient le role a la connexion", async () => {
  const compte = await createUser({
    name: "Patron",
    email: "patron@faso-zik.bf",
    password: "motdepasse12",
  });
  assert.equal(compte.role, "auditeur");

  // La casse et les espaces de la liste ne doivent pas compter.
  process.env.ADMIN_EMAILS = "autre@exemple.bf, Patron@Faso-Zik.bf ";
  assert.deepEqual(adressesAdmin(), ["autre@exemple.bf", "patron@faso-zik.bf"]);

  assert.equal(await roleALaConnexion(compte), "admin");
  // Le role est bien inscrit en base, pas seulement dans la session.
  assert.equal((await rafraichirJeton(compte.id)).role, "admin");

  delete process.env.ADMIN_EMAILS;
});

test("sans liste, aucun compte n'est promu", async () => {
  delete process.env.ADMIN_EMAILS;
  const compte = await createUser({
    name: "Quidam",
    email: "quidam@exemple.bf",
    password: "motdepasse12",
  });
  assert.equal(await roleALaConnexion(compte), "auditeur");
});

test("une adresse ajoutee en cours de session est promue au rafraichissement", async () => {
  const compte = await createUser({
    name: "Tardif",
    email: "tardif@faso-zik.bf",
    password: "motdepasse12",
  });

  // Connexion d'abord, variable ensuite : c'est l'ordre qui piegeait.
  delete process.env.ADMIN_EMAILS;
  assert.equal((await rafraichirJeton(compte.id)).role, "auditeur");

  process.env.ADMIN_EMAILS = "tardif@faso-zik.bf";
  assert.equal(
    (await rafraichirJeton(compte.id)).role,
    "admin",
    "le role doit s'appliquer sans deconnexion",
  );

  // Et il reste inscrit en base, meme si la variable disparait ensuite.
  delete process.env.ADMIN_EMAILS;
  assert.equal((await rafraichirJeton(compte.id)).role, "admin");
});
