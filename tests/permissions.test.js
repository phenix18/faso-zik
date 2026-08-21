import test from "node:test";
import assert from "node:assert/strict";
import {
  canDownload,
  canStream,
  canUseInDj,
  estPayant,
  ownsTrack,
  peutTelecharger,
} from "@/lib/permissions";

/** Ligne de morceau telle qu'elle sort de la base. */
function track(overrides = {}) {
  return {
    artist_id: "art_1",
    published: 1,
    allow_stream: 1,
    allow_download: 0,
    allow_dj: 0,
    price_cfa: 0,
    ...overrides,
  };
}

test("l'ecoute suit allow_stream et published", () => {
  assert.equal(canStream(track()), true);
  assert.equal(canStream(track({ allow_stream: 0 })), false);
  assert.equal(canStream(track({ published: 0 })), false);
  assert.equal(canStream(null), false);
});

test("le telechargement est refuse par defaut", () => {
  assert.equal(canDownload(track()), false);
  assert.equal(canDownload(track({ allow_download: 1 })), true);
});

test("retirer l'ecoute retire aussi le telechargement et la platine", () => {
  const ouvert = track({ allow_download: 1, allow_dj: 1, allow_stream: 0 });
  assert.equal(canDownload(ouvert), false);
  assert.equal(canUseInDj(ouvert), false);
});

test("un titre depublie sort de la platine", () => {
  assert.equal(canUseInDj(track({ allow_dj: 1 })), true);
  assert.equal(canUseInDj(track({ allow_dj: 1, published: 0 })), false);
});

test("seul l'artiste proprietaire, ou un administrateur, possede le morceau", () => {
  const morceau = track();
  assert.equal(ownsTrack({ role: "artiste", artistId: "art_1" }, morceau), true);
  assert.equal(ownsTrack({ role: "artiste", artistId: "art_2" }, morceau), false);
  assert.equal(ownsTrack({ role: "admin" }, morceau), true);
  assert.equal(ownsTrack(null, morceau), false);
  assert.equal(ownsTrack({ role: "auditeur" }, morceau), false);
});

test("un titre est payant seulement si l'artiste l'autorise et fixe un prix", () => {
  assert.equal(estPayant(track({ price_cfa: 500 })), false, "sans autorisation, rien n'est vendu");
  assert.equal(estPayant(track({ allow_download: 1, price_cfa: 0 })), false);
  assert.equal(estPayant(track({ allow_download: 1, price_cfa: 500 })), true);
});

test("un telechargement gratuit ne demande aucun paiement", () => {
  const gratuit = track({ allow_download: 1 });
  assert.equal(peutTelecharger(gratuit), true);
  assert.equal(peutTelecharger(gratuit, { dejaPaye: false }), true);
});

test("un telechargement payant exige un paiement abouti", () => {
  const payant = track({ allow_download: 1, price_cfa: 500 });
  assert.equal(peutTelecharger(payant), false);
  assert.equal(peutTelecharger(payant, { dejaPaye: true }), true);
});

test("l'artiste telecharge ses propres titres payants", () => {
  const payant = track({ allow_download: 1, price_cfa: 500 });
  assert.equal(peutTelecharger(payant, { user: { role: "artiste", artistId: "art_1" } }), true);
  assert.equal(peutTelecharger(payant, { user: { role: "artiste", artistId: "art_2" } }), false);
  assert.equal(peutTelecharger(payant, { user: { role: "admin" } }), true);
});

test("payer ne contourne pas le refus de l'artiste", () => {
  // Le titre a ete achete, puis l'artiste a ferme le telechargement.
  const ferme = track({ allow_download: 0, price_cfa: 500 });
  assert.equal(peutTelecharger(ferme, { dejaPaye: true }), false);

  const retire = track({ allow_download: 1, price_cfa: 500, allow_stream: 0 });
  assert.equal(peutTelecharger(retire, { dejaPaye: true }), false);
});

test("un auditeur sans fiche artiste ne possede rien", () => {
  // artistId vaut null pour un compte auditeur : il ne doit jamais
  // correspondre a un artist_id, meme si celui-ci etait nul en base.
  assert.equal(ownsTrack({ role: "auditeur", artistId: null }, track({ artist_id: null })), false);
});
