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
    published: true,
    allow_stream: true,
    allow_download: false,
    allow_dj: false,
    price_cfa: 0,
    ...overrides,
  };
}

test("l'ecoute suit allow_stream et published", () => {
  assert.equal(canStream(track()), true);
  assert.equal(canStream(track({ allow_stream: false })), false);
  assert.equal(canStream(track({ published: false })), false);
  assert.equal(canStream(null), false);
});

test("le telechargement est refuse par defaut", () => {
  assert.equal(canDownload(track()), false);
  assert.equal(canDownload(track({ allow_download: true })), true);
});

test("retirer l'ecoute retire aussi le telechargement et la platine", () => {
  const ouvert = track({ allow_download: true, allow_dj: true, allow_stream: false });
  assert.equal(canDownload(ouvert), false);
  assert.equal(canUseInDj(ouvert), false);
});

test("un titre depublie sort de la platine", () => {
  assert.equal(canUseInDj(track({ allow_dj: true })), true);
  assert.equal(canUseInDj(track({ allow_dj: true, published: false })), false);
});

test("seul l'artiste proprietaire, ou un administrateur, possede le morceau", () => {
  const morceau = track();
  assert.equal(ownsTrack({ role: "artiste", artistId: "art_1" }, morceau), true);
  assert.equal(ownsTrack({ role: "artiste", artistId: "art_2" }, morceau), false);
  assert.equal(ownsTrack({ role: "admin" }, morceau), true);
  assert.equal(ownsTrack(null, morceau), false);
  assert.equal(ownsTrack({ role: "auditeur" }, morceau), false);
});

test("un auditeur sans fiche artiste ne possede rien", () => {
  assert.equal(ownsTrack({ role: "auditeur", artistId: null }, track({ artist_id: null })), false);
});

test("un titre est payant seulement si l'artiste l'autorise et fixe un prix", () => {
  assert.equal(estPayant(track({ price_cfa: 500 })), false, "sans autorisation, rien n'est vendu");
  assert.equal(estPayant(track({ allow_download: true, price_cfa: 0 })), false);
  assert.equal(estPayant(track({ allow_download: true, price_cfa: 500 })), true);
});

test("un telechargement gratuit ne demande aucun paiement", () => {
  const gratuit = track({ allow_download: true });
  assert.equal(peutTelecharger(gratuit), true);
  assert.equal(peutTelecharger(gratuit, { dejaPaye: false }), true);
});

test("un telechargement payant exige un paiement abouti", () => {
  const payant = track({ allow_download: true, price_cfa: 500 });
  assert.equal(peutTelecharger(payant), false);
  assert.equal(peutTelecharger(payant, { dejaPaye: true }), true);
});

test("l'artiste telecharge ses propres titres payants", () => {
  const payant = track({ allow_download: true, price_cfa: 500 });
  assert.equal(peutTelecharger(payant, { user: { role: "artiste", artistId: "art_1" } }), true);
  assert.equal(peutTelecharger(payant, { user: { role: "artiste", artistId: "art_2" } }), false);
  assert.equal(peutTelecharger(payant, { user: { role: "admin" } }), true);
});

test("payer ne contourne pas le refus de l'artiste", () => {
  const ferme = track({ allow_download: false, price_cfa: 500 });
  assert.equal(peutTelecharger(ferme, { dejaPaye: true }), false);

  const retire = track({ allow_download: true, price_cfa: 500, allow_stream: false });
  assert.equal(peutTelecharger(retire, { dejaPaye: true }), false);
});
