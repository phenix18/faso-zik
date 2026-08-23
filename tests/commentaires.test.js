/**
 * Commentaires : lire est ouvert, ecrire demande un compte.
 *
 * Le retrait masque plutot qu'il n'efface, pour qu'une moderation contestee
 * puisse etre revue et qu'on sache qui l'a decidee.
 */
import test from "node:test";
import assert from "node:assert/strict";

const { createUser, promoteToArtist } = await import("@/lib/repo/users");
const { getArtistByUserId } = await import("@/lib/repo/artists");
const { createTrack } = await import("@/lib/repo/tracks");
const {
  ajouterCommentaire,
  commentairesDuTitre,
  commentaireParId,
  compterCommentaires,
  masquerCommentaire,
} = await import("@/lib/repo/comments");
const { query } = await import("@/lib/db");

async function decor(suffixe) {
  const artisteCompte = await createUser({
    name: "Artiste",
    email: `artiste-${suffixe}@exemple.bf`,
    password: "motdepasse12",
  });
  await promoteToArtist(artisteCompte.id, { stageName: `Artiste ${suffixe}` });
  const artiste = await getArtistByUserId(artisteCompte.id);
  const titre = await createTrack({
    artistId: artiste.id,
    title: "Titre",
    kind: "audio",
    mediaPath: `audio/${suffixe}.mp3`,
    mediaMime: "audio/mpeg",
    mediaSize: 1024,
  });
  const auditeur = await createUser({
    name: "Auditeur",
    email: `auditeur-${suffixe}@exemple.bf`,
    password: "motdepasse12",
  });
  return { titre, auditeur, artisteCompte };
}

test("un commentaire publie apparait sous le titre", async () => {
  const { titre, auditeur } = await decor("a");
  const cree = await ajouterCommentaire({
    trackId: titre.id,
    userId: auditeur.id,
    corps: "  Ce balafon est magnifique.  ",
  });

  assert.equal(cree.corps, "Ce balafon est magnifique."); // borne et nettoye
  assert.equal(cree.auteur.nom, "Auditeur");

  const liste = await commentairesDuTitre(titre.id);
  assert.equal(liste.length, 1);
  assert.equal(await compterCommentaires(titre.id), 1);
});

test("un commentaire vide est refuse", async () => {
  const { titre, auditeur } = await decor("b");
  await assert.rejects(
    () => ajouterCommentaire({ trackId: titre.id, userId: auditeur.id, corps: "   " }),
    /vide/,
  );
});

test("le retrait masque le commentaire sans l'effacer", async () => {
  const { titre, auditeur, artisteCompte } = await decor("c");
  const cree = await ajouterCommentaire({
    trackId: titre.id,
    userId: auditeur.id,
    corps: "A retirer.",
  });

  await masquerCommentaire(cree.id, artisteCompte.id);

  assert.deepEqual(await commentairesDuTitre(titre.id), []);
  assert.equal(await compterCommentaires(titre.id), 0);

  // La ligne demeure, avec la trace de qui a retire.
  const [ligne] = await query("SELECT masque, masque_par FROM comments WHERE id = $1", [cree.id]);
  assert.equal(ligne.masque, true);
  assert.equal(ligne.masque_par, artisteCompte.id);
  assert.equal((await commentaireParId(cree.id)).masque, true);
});

test("les commentaires partent avec leur morceau", async () => {
  const { titre, auditeur } = await decor("d");
  await ajouterCommentaire({ trackId: titre.id, userId: auditeur.id, corps: "Bien." });

  await query("DELETE FROM tracks WHERE id = $1", [titre.id]);

  const [{ n }] = await query(
    "SELECT count(*)::int AS n FROM comments WHERE track_id = $1",
    [titre.id],
  );
  assert.equal(n, 0);
});
