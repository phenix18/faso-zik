import test from "node:test";
import assert from "node:assert/strict";


const { createUser } = await import("@/lib/repo/users");
const { getArtistByUserId } = await import("@/lib/repo/artists");
const { createTrack, getTrack, listTracks } = await import("@/lib/repo/tracks");
const {
  creerAlbum,
  albumParSlug,
  albumsArtiste,
  titresAlbum,
  rattacherTitre,
  supprimerAlbum,
  modifierAlbum,
  typeAlbumValide,
} = await import("@/lib/repo/albums");

const artiste = await getArtistByUserId(
  (await createUser({
    name: "Yennenga Sound",
    email: "yennenga@albums.bf",
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
    duration: 180,
    ...options,
  });
}

test("un album se retrouve par son artiste et son identifiant d'URL", async () => {
  const album = await creerAlbum({ artistId: artiste.id, titre: "Faso Denya", kind: "ep" });

  assert.equal(album.slug, "faso-denya");
  assert.equal(album.kind, "ep");
  assert.equal((await albumParSlug("yennenga-sound", "faso-denya")).id, album.id);
  assert.equal(await albumParSlug("un-autre-artiste", "faso-denya"), null);
});

test("deux albums de meme titre recoivent des identifiants distincts", async () => {
  await creerAlbum({ artistId: artiste.id, titre: "Live" });
  const second = await creerAlbum({ artistId: artiste.id, titre: "Live" });
  assert.equal(second.slug, "live-2");
});

test("un type inconnu retombe sur album", async () => {
  assert.equal(typeAlbumValide("ep"), true);
  assert.equal(typeAlbumValide("mixtape"), false);
  assert.equal((await creerAlbum({ artistId: artiste.id, titre: "Type", kind: "mixtape" })).kind, "album");
});

test("les titres suivent le rang donne par l'artiste", async () => {
  const album = await creerAlbum({ artistId: artiste.id, titre: "Harmattan" });
  const premier = await deposer("Ouverture");
  const second = await deposer("Milieu");
  const troisieme = await deposer("Final");

  // Ranges dans le desordre, avec des rangs explicites.
  await rattacherTitre(troisieme.id, album.id, 3);
  await rattacherTitre(premier.id, album.id, 1);
  await rattacherTitre(second.id, album.id, 2);

  assert.deepEqual(
    (await titresAlbum(album.id)).map((titre) => titre.title),
    ["Ouverture", "Milieu", "Final"],
  );
});

test("un titre sans rang passe apres ceux qui en ont un", async () => {
  const album = await creerAlbum({ artistId: artiste.id, titre: "Sans rang" });
  const range = await deposer("Range");
  const flottant = await deposer("Flottant");

  await rattacherTitre(range.id, album.id, 1);
  await rattacherTitre(flottant.id, album.id, null);

  assert.deepEqual(
    (await titresAlbum(album.id)).map((titre) => titre.title),
    ["Range", "Flottant"],
  );
});

test("un titre depublie disparait de l'album pour le public", async () => {
  const album = await creerAlbum({ artistId: artiste.id, titre: "Avec un retire" });
  const visible = await deposer("Visible");
  const retire = await deposer("Retire", { published: false });

  await rattacherTitre(visible.id, album.id, 1);
  await rattacherTitre(retire.id, album.id, 2);

  assert.equal((await titresAlbum(album.id)).length, 1);
  assert.equal((await titresAlbum(album.id, { includeUnpublished: true })).length, 2);
});

test("le titre herite de la pochette de son album a defaut de la sienne", async () => {
  const album = await creerAlbum({ artistId: artiste.id, titre: "Avec pochette" });
  await modifierAlbum(album.id, { coverUrl: "/api/asset/image/pochette.jpg" });

  const sans = await deposer("Sans pochette");
  const avec = await deposer("Pochette propre", { coverUrl: "/api/asset/image/propre.jpg" });
  await rattacherTitre(sans.id, album.id, 1);
  await rattacherTitre(avec.id, album.id, 2);

  assert.equal((await getTrack(sans.id)).coverUrl, "/api/asset/image/pochette.jpg");
  assert.equal((await getTrack(avec.id)).coverUrl, "/api/asset/image/propre.jpg", "la sienne l'emporte");
});

test("detacher un titre le rend isole sans le supprimer", async () => {
  const album = await creerAlbum({ artistId: artiste.id, titre: "Provisoire" });
  const titre = await deposer("Provisoire un");
  await rattacherTitre(titre.id, album.id, 1);
  assert.equal((await getTrack(titre.id)).album.id, album.id);

  await rattacherTitre(titre.id, null, null);
  assert.equal((await getTrack(titre.id)).album, null);
  assert.ok(await getTrack(titre.id), "le titre existe toujours");
});

test("supprimer un album conserve ses titres", async () => {
  const album = await creerAlbum({ artistId: artiste.id, titre: "A supprimer" });
  const titre = await deposer("Survivant");
  await rattacherTitre(titre.id, album.id, 1);

  await supprimerAlbum(album.id);

  const releve = await getTrack(titre.id);
  assert.ok(releve, "le titre survit a son album");
  assert.equal(releve.album, null);
});

test("les albums vides peuvent etre ecartes de la page publique", async () => {
  await creerAlbum({ artistId: artiste.id, titre: "Annonce sans titre" });

  const tous = await albumsArtiste(artiste.id);
  const remplis = await albumsArtiste(artiste.id, { inclureVides: false });

  assert.ok(tous.length > remplis.length);
  assert.ok(remplis.every((album) => album.titres > 0));
});

test("le filtre par album ne renvoie que ses titres", async () => {
  const album = await creerAlbum({ artistId: artiste.id, titre: "Filtre" });
  const dedans = await deposer("Dedans");
  await deposer("Dehors");
  await rattacherTitre(dedans.id, album.id, 1);

  const resultat = await listTracks({ albumId: album.id });
  assert.equal(resultat.length, 1);
  assert.equal(resultat[0].title, "Dedans");
});
