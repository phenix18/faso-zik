import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

process.env.DATABASE_FILE = path.join(
  fs.mkdtempSync(path.join(os.tmpdir(), "fz-albums-")),
  "albums.db",
);

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

const artiste = getArtistByUserId(
  createUser({
    name: "Yennenga Sound",
    email: "yennenga@albums.bf",
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
    duration: 180,
    ...options,
  });
}

test("un album se retrouve par son artiste et son identifiant d'URL", () => {
  const album = creerAlbum({ artistId: artiste.id, titre: "Faso Denya", kind: "ep" });

  assert.equal(album.slug, "faso-denya");
  assert.equal(album.kind, "ep");
  assert.equal(albumParSlug("yennenga-sound", "faso-denya").id, album.id);
  assert.equal(albumParSlug("un-autre-artiste", "faso-denya"), undefined);
});

test("deux albums de meme titre recoivent des identifiants distincts", () => {
  creerAlbum({ artistId: artiste.id, titre: "Live" });
  const second = creerAlbum({ artistId: artiste.id, titre: "Live" });
  assert.equal(second.slug, "live-2");
});

test("un type inconnu retombe sur album", () => {
  assert.equal(typeAlbumValide("ep"), true);
  assert.equal(typeAlbumValide("mixtape"), false);
  assert.equal(creerAlbum({ artistId: artiste.id, titre: "Type", kind: "mixtape" }).kind, "album");
});

test("les titres suivent le rang donne par l'artiste", () => {
  const album = creerAlbum({ artistId: artiste.id, titre: "Harmattan" });
  const premier = deposer("Ouverture");
  const second = deposer("Milieu");
  const troisieme = deposer("Final");

  // Ranges dans le desordre, avec des rangs explicites.
  rattacherTitre(troisieme.id, album.id, 3);
  rattacherTitre(premier.id, album.id, 1);
  rattacherTitre(second.id, album.id, 2);

  assert.deepEqual(
    titresAlbum(album.id).map((titre) => titre.title),
    ["Ouverture", "Milieu", "Final"],
  );
});

test("un titre sans rang passe apres ceux qui en ont un", () => {
  const album = creerAlbum({ artistId: artiste.id, titre: "Sans rang" });
  const range = deposer("Range");
  const flottant = deposer("Flottant");

  rattacherTitre(range.id, album.id, 1);
  rattacherTitre(flottant.id, album.id, null);

  assert.deepEqual(
    titresAlbum(album.id).map((titre) => titre.title),
    ["Range", "Flottant"],
  );
});

test("un titre depublie disparait de l'album pour le public", () => {
  const album = creerAlbum({ artistId: artiste.id, titre: "Avec un retire" });
  const visible = deposer("Visible");
  const retire = deposer("Retire", { published: false });

  rattacherTitre(visible.id, album.id, 1);
  rattacherTitre(retire.id, album.id, 2);

  assert.equal(titresAlbum(album.id).length, 1);
  assert.equal(titresAlbum(album.id, { includeUnpublished: true }).length, 2);
});

test("le titre herite de la pochette de son album a defaut de la sienne", () => {
  const album = creerAlbum({ artistId: artiste.id, titre: "Avec pochette" });
  modifierAlbum(album.id, { coverUrl: "/api/asset/image/pochette.jpg" });

  const sans = deposer("Sans pochette");
  const avec = deposer("Pochette propre", { coverUrl: "/api/asset/image/propre.jpg" });
  rattacherTitre(sans.id, album.id, 1);
  rattacherTitre(avec.id, album.id, 2);

  assert.equal(getTrack(sans.id).coverUrl, "/api/asset/image/pochette.jpg");
  assert.equal(getTrack(avec.id).coverUrl, "/api/asset/image/propre.jpg", "la sienne l'emporte");
});

test("detacher un titre le rend isole sans le supprimer", () => {
  const album = creerAlbum({ artistId: artiste.id, titre: "Provisoire" });
  const titre = deposer("Provisoire un");
  rattacherTitre(titre.id, album.id, 1);
  assert.equal(getTrack(titre.id).album.id, album.id);

  rattacherTitre(titre.id, null, null);
  assert.equal(getTrack(titre.id).album, null);
  assert.ok(getTrack(titre.id), "le titre existe toujours");
});

test("supprimer un album conserve ses titres", () => {
  const album = creerAlbum({ artistId: artiste.id, titre: "A supprimer" });
  const titre = deposer("Survivant");
  rattacherTitre(titre.id, album.id, 1);

  supprimerAlbum(album.id);

  const releve = getTrack(titre.id);
  assert.ok(releve, "le titre survit a son album");
  assert.equal(releve.album, null);
});

test("les albums vides peuvent etre ecartes de la page publique", () => {
  creerAlbum({ artistId: artiste.id, titre: "Annonce sans titre" });

  const tous = albumsArtiste(artiste.id);
  const remplis = albumsArtiste(artiste.id, { inclureVides: false });

  assert.ok(tous.length > remplis.length);
  assert.ok(remplis.every((album) => album.titres > 0));
});

test("le filtre par album ne renvoie que ses titres", () => {
  const album = creerAlbum({ artistId: artiste.id, titre: "Filtre" });
  const dedans = deposer("Dedans");
  deposer("Dehors");
  rattacherTitre(dedans.id, album.id, 1);

  const resultat = listTracks({ albumId: album.id });
  assert.equal(resultat.length, 1);
  assert.equal(resultat[0].title, "Dedans");
});
