import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// Base jetable : le module lit DATABASE_FILE au premier acces.
process.env.DATABASE_FILE = path.join(
  fs.mkdtempSync(path.join(os.tmpdir(), "fz-db-")),
  "catalogue.db",
);

const { createUser, promoteToArtist } = await import("@/lib/repo/users");
const { getArtistByUserId, artistStats } = await import("@/lib/repo/artists");
const { createTrack, getTrack, listTracks, updateTrack, recordEvent, deleteTrack } = await import(
  "@/lib/repo/tracks"
);
const { toggleFavourite, listFavourites, createPlaylist, addToPlaylist, getPlaylist } =
  await import("@/lib/repo/library");

const artiste = getArtistByUserId(
  createUser({
    name: "Yennenga Sound",
    email: "yennenga@test.bf",
    password: "motdepasse123",
    role: "artiste",
  }).id,
);

function deposer(titre, options = {}) {
  return createTrack({
    artistId: artiste.id,
    title: titre,
    kind: "audio",
    mediaPath: `audio/${titre}.mp3`,
    mediaMime: "audio/mpeg",
    mediaSize: 4096,
    ...options,
  });
}

test("creer un compte artiste cree sa fiche dans la foulee", () => {
  assert.ok(artiste, "la fiche artiste doit exister");
  assert.equal(artiste.slug, "yennenga-sound");
});

test("une adresse e-mail ne sert qu'une fois", () => {
  assert.throws(
    () =>
      createUser({ name: "Autre", email: "yennenga@test.bf", password: "motdepasse123" }),
    /existe deja/,
  );
});

test("un auditeur promu artiste recoit une fiche, sans doublon", () => {
  const auditeur = createUser({
    name: "Bobo Kanou",
    email: "bobo@test.bf",
    password: "motdepasse123",
  });
  assert.equal(auditeur.role, "auditeur");

  const fiche = promoteToArtist(auditeur.id, { stageName: "Bobo Kanou", city: "Bobo-Dioulasso" });
  assert.equal(fiche.slug, "bobo-kanou");
  assert.equal(promoteToArtist(auditeur.id).id, fiche.id, "un second appel ne recree rien");
});

test("un nouveau depot n'est ni telechargeable ni ouvert aux DJ", () => {
  const morceau = deposer("Faso Denya");
  assert.deepEqual(morceau.permissions, { stream: true, download: false, dj: false });
  assert.equal(morceau.downloadUrl, null, "aucune adresse de telechargement n'est exposee");
  assert.equal(morceau.streamUrl, `/api/stream/${morceau.id}`);
});

test("le chemin disque du fichier ne sort jamais vers le navigateur", () => {
  const morceau = deposer("Balafon Sunrise");
  assert.equal(JSON.stringify(morceau).includes("audio/Balafon"), false);
});

test("deux titres identiques recoivent des slugs distincts", () => {
  const premier = deposer("Harmattan");
  const second = deposer("Harmattan");
  assert.equal(premier.slug, "harmattan");
  assert.equal(second.slug, "harmattan-2");
});

test("ouvrir le telechargement expose l'adresse correspondante", () => {
  const morceau = deposer("Yatenga Circuit");
  assert.equal(morceau.downloadUrl, null);

  const ouvert = updateTrack(morceau.id, { allowDownload: true });
  assert.equal(ouvert.permissions.download, true);
  assert.equal(ouvert.downloadUrl, `/api/download/${morceau.id}`);

  const referme = updateTrack(morceau.id, { allowDownload: false });
  assert.equal(referme.downloadUrl, null);
});

test("un titre depublie sort des listes publiques", () => {
  const morceau = deposer("Maquette privee", { published: false });
  const publics = listTracks({ artistId: artiste.id }).map((t) => t.id);
  assert.equal(publics.includes(morceau.id), false);

  const tout = listTracks({ artistId: artiste.id, includeUnpublished: true }).map((t) => t.id);
  assert.ok(tout.includes(morceau.id), "l'artiste voit son titre depuis son studio");
});

test("la recherche porte sur le titre, l'artiste et le genre", () => {
  deposer("Ouaga la Nuit", { genre: "Coupe-decale" });
  assert.ok(listTracks({ search: "ouaga" }).length >= 1);
  assert.ok(listTracks({ search: "yennenga" }).length >= 1);
  assert.ok(listTracks({ search: "coupe" }).length >= 1);
  assert.equal(listTracks({ search: "reggaeton-portoricain" }).length, 0);
});

test("les ecoutes et telechargements sont comptes separement", () => {
  const morceau = deposer("Compteurs");
  recordEvent(morceau.id, "play");
  recordEvent(morceau.id, "play");
  recordEvent(morceau.id, "download");

  const relu = getTrack(morceau.id);
  assert.equal(relu.plays, 2);
  assert.equal(relu.downloads, 1);
});

test("les statistiques du studio agregent le catalogue", () => {
  const stats = artistStats(artiste.id);
  assert.ok(stats.tracks > 0);
  assert.equal(typeof stats.plays, "number");
  assert.equal(typeof stats.dj_ready, "number");
});

test("le favori bascule dans les deux sens", () => {
  const auditeur = createUser({
    name: "Auditrice",
    email: "auditrice@test.bf",
    password: "motdepasse123",
  });
  const morceau = deposer("A mettre en favori");

  assert.equal(toggleFavourite(auditeur.id, morceau.id), true);
  assert.equal(listFavourites(auditeur.id).length, 1);
  assert.equal(toggleFavourite(auditeur.id, morceau.id), false);
  assert.equal(listFavourites(auditeur.id).length, 0);
});

test("une playlist conserve l'ordre d'ajout", () => {
  const proprietaire = createUser({
    name: "Selecteur",
    email: "selecteur@test.bf",
    password: "motdepasse123",
  });
  const playlist = createPlaylist(proprietaire.id, "Soirees a Ouaga");
  const premier = deposer("Piste une");
  const second = deposer("Piste deux");

  addToPlaylist(playlist.id, premier.id);
  addToPlaylist(playlist.id, second.id);

  const relue = getPlaylist(playlist.id);
  assert.deepEqual(
    relue.tracks.map((t) => t.title),
    ["Piste une", "Piste deux"],
  );
});

test("supprimer un morceau le retire des favoris et des playlists", () => {
  const auditeur = createUser({
    name: "Ephemere",
    email: "ephemere@test.bf",
    password: "motdepasse123",
  });
  const morceau = deposer("A supprimer");
  const playlist = createPlaylist(auditeur.id, "Liste");
  toggleFavourite(auditeur.id, morceau.id);
  addToPlaylist(playlist.id, morceau.id);

  deleteTrack(morceau.id);

  assert.equal(getTrack(morceau.id), null);
  assert.equal(listFavourites(auditeur.id).length, 0);
  assert.equal(getPlaylist(playlist.id).tracks.length, 0);
});
