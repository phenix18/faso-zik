import test from "node:test";
import assert from "node:assert/strict";

// Base jetable : sans DATABASE_URL, PGlite monte un PostgreSQL en memoire.

const { createUser, promoteToArtist } = await import("@/lib/repo/users");
const { getArtistByUserId, artistStats } = await import("@/lib/repo/artists");
const { createTrack, getTrack, listTracks, updateTrack, recordEvent, deleteTrack } = await import(
  "@/lib/repo/tracks"
);
const { toggleFavourite, listFavourites, createPlaylist, addToPlaylist, getPlaylist } =
  await import("@/lib/repo/library");

const artiste = await getArtistByUserId(
  (await createUser({
    name: "Yennenga Sound",
    email: "yennenga@test.bf",
    password: "motdepasse123",
    role: "artiste",
  })).id,
);

async function deposer(titre, options = {}) {
  return await createTrack({
    artistId: artiste.id,
    title: titre,
    kind: "audio",
    mediaPath: `audio/${titre}.mp3`,
    mediaMime: "audio/mpeg",
    mediaSize: 4096,
    ...options,
  });
}

test("creer un compte artiste cree sa fiche dans la foulee", async () => {
  assert.ok(artiste, "la fiche artiste doit exister");
  assert.equal(artiste.slug, "yennenga-sound");
});

test("une adresse e-mail ne sert qu'une fois", async () => {
  await assert.rejects(
    () => createUser({ name: "Autre", email: "yennenga@test.bf", password: "motdepasse123" }),
    /existe deja/,
  );
});

test("un auditeur promu artiste recoit une fiche, sans doublon", async () => {
  const auditeur = await createUser({
    name: "Bobo Kanou",
    email: "bobo@test.bf",
    password: "motdepasse123",
  });
  assert.equal(auditeur.role, "auditeur");

  const fiche = await promoteToArtist(auditeur.id, { stageName: "Bobo Kanou", city: "Bobo-Dioulasso" });
  assert.equal(fiche.slug, "bobo-kanou");
  assert.equal((await promoteToArtist(auditeur.id)).id, fiche.id, "un second appel ne recree rien");
});

test("un nouveau depot n'est ni telechargeable ni ouvert aux DJ", async () => {
  const morceau = await deposer("Faso Denya");
  assert.deepEqual(morceau.permissions, {
    stream: true,
    download: false,
    dj: false,
    downloadPaid: false,
  });
  assert.equal(morceau.downloadUrl, null, "aucune adresse de telechargement n'est exposee");
  assert.equal(morceau.streamUrl, `/api/stream/${morceau.id}`);
});

test("le chemin disque du fichier ne sort jamais vers le navigateur", async () => {
  const morceau = await deposer("Balafon Sunrise");
  assert.equal(JSON.stringify(morceau).includes("audio/Balafon"), false);
});

test("deux titres identiques recoivent des slugs distincts", async () => {
  const premier = await deposer("Harmattan");
  const second = await deposer("Harmattan");
  assert.equal(premier.slug, "harmattan");
  assert.equal(second.slug, "harmattan-2");
});

test("ouvrir le telechargement expose l'adresse correspondante", async () => {
  const morceau = await deposer("Yatenga Circuit");
  assert.equal(morceau.downloadUrl, null);

  const ouvert = await updateTrack(morceau.id, { allowDownload: true });
  assert.equal(ouvert.permissions.download, true);
  assert.equal(ouvert.downloadUrl, `/api/download/${morceau.id}`);

  const referme = await updateTrack(morceau.id, { allowDownload: false });
  assert.equal(referme.downloadUrl, null);
});

test("un titre payant n'expose pas de lien de telechargement direct", async () => {
  const morceau = await deposer("A vendre", { allowDownload: true, priceCfa: 500 });
  assert.equal(morceau.priceCfa, 500);
  assert.equal(morceau.permissions.download, true);
  assert.equal(morceau.permissions.downloadPaid, true);
  assert.equal(morceau.downloadUrl, null, "le lien direct passerait outre le paiement");

  // Ramene a la gratuite, le lien reapparait.
  const gratuit = await updateTrack(morceau.id, { priceCfa: 0 });
  assert.equal(gratuit.permissions.downloadPaid, false);
  assert.equal(gratuit.downloadUrl, `/api/download/${morceau.id}`);
});

test("un titre depublie sort des listes publiques", async () => {
  const morceau = await deposer("Maquette privee", { published: false });
  const publics = (await listTracks({ artistId: artiste.id })).map((t) => t.id);
  assert.equal(publics.includes(morceau.id), false);

  const tout = (await listTracks({ artistId: artiste.id, includeUnpublished: true })).map((t) => t.id);
  assert.ok(tout.includes(morceau.id), "l'artiste voit son titre depuis son studio");
});

test("la recherche porte sur le titre, l'artiste et le genre", async () => {
  await deposer("Ouaga la Nuit", { genre: "Coupe-decale" });
  assert.ok((await listTracks({ search: "ouaga" })).length >= 1);
  assert.ok((await listTracks({ search: "yennenga" })).length >= 1);
  assert.ok((await listTracks({ search: "coupe" })).length >= 1);
  assert.equal((await listTracks({ search: "reggaeton-portoricain" })).length, 0);
});

test("les ecoutes et telechargements sont comptes separement", async () => {
  const morceau = await deposer("Compteurs");
  await recordEvent(morceau.id, "play");
  await recordEvent(morceau.id, "play");
  await recordEvent(morceau.id, "download");

  const relu = await getTrack(morceau.id);
  assert.equal(relu.plays, 2);
  assert.equal(relu.downloads, 1);
});

test("les statistiques du studio agregent le catalogue", async () => {
  const stats = await artistStats(artiste.id);
  assert.ok(stats.tracks > 0);
  assert.equal(typeof stats.plays, "number");
  assert.equal(typeof stats.dj_ready, "number");
});

test("le favori bascule dans les deux sens", async () => {
  const auditeur = await createUser({
    name: "Auditrice",
    email: "auditrice@test.bf",
    password: "motdepasse123",
  });
  const morceau = await deposer("A mettre en favori");

  assert.equal(await toggleFavourite(auditeur.id, morceau.id), true);
  assert.equal((await listFavourites(auditeur.id)).length, 1);
  assert.equal(await toggleFavourite(auditeur.id, morceau.id), false);
  assert.equal((await listFavourites(auditeur.id)).length, 0);
});

test("une playlist conserve l'ordre d'ajout", async () => {
  const proprietaire = await createUser({
    name: "Selecteur",
    email: "selecteur@test.bf",
    password: "motdepasse123",
  });
  const playlist = await createPlaylist(proprietaire.id, "Soirees a Ouaga");
  const premier = await deposer("Piste une");
  const second = await deposer("Piste deux");

  await addToPlaylist(playlist.id, premier.id);
  await addToPlaylist(playlist.id, second.id);

  const relue = await getPlaylist(playlist.id);
  assert.deepEqual(
    relue.tracks.map((t) => t.title),
    ["Piste une", "Piste deux"],
  );
});

test("supprimer un morceau le retire des favoris et des playlists", async () => {
  const auditeur = await createUser({
    name: "Ephemere",
    email: "ephemere@test.bf",
    password: "motdepasse123",
  });
  const morceau = await deposer("A supprimer");
  const playlist = await createPlaylist(auditeur.id, "Liste");
  await toggleFavourite(auditeur.id, morceau.id);
  await addToPlaylist(playlist.id, morceau.id);

  await deleteTrack(morceau.id);

  assert.equal(await getTrack(morceau.id), null);
  assert.equal((await listFavourites(auditeur.id)).length, 0);
  assert.equal((await getPlaylist(playlist.id)).tracks.length, 0);
});
