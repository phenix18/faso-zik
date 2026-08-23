import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";

process.env.PAIEMENT_API_URL = "https://agregateur.test";
process.env.PAIEMENT_API_CLE = "cle-publique";
process.env.PAIEMENT_API_SECRET = "secret-partage";
process.env.COMMISSION_POURCENT = "10";

const { normaliserNumero, operateurValide, fournisseurActif } = await import("@/lib/paiement");
const { agregateur } = await import("@/lib/paiement/agregateur");
const { createUser } = await import("@/lib/repo/users");
const { getArtistByUserId } = await import("@/lib/repo/artists");
const { createTrack } = await import("@/lib/repo/tracks");
const { creerPaiement, conclurePaiement, aAchete, revenusArtiste, paiementParReference } =
  await import("@/lib/repo/payments");

const artiste = await getArtistByUserId(
  (await createUser({
    name: "Sahel Digital",
    email: "sahel@test.bf",
    password: "motdepasse123",
    role: "artiste",
  })).id,
);
const auditeur = await createUser({
  name: "Awa",
  email: "awa@test.bf",
  password: "motdepasse123",
});
const morceau = await createTrack({
  artistId: artiste.id,
  title: "Yatenga",
  kind: "audio",
  mediaPath: "audio/yatenga.mp3",
  mediaMime: "audio/mpeg",
  mediaSize: 1024,
  allowDownload: true,
  priceCfa: 1000,
});

/* ---------------------------- numeros et operateurs --------------------- */

test("un numero burkinabe est accepte sous ses formes courantes", async () => {
  assert.equal(normaliserNumero("70123456"), "+22670123456");
  assert.equal(normaliserNumero("70 12 34 56"), "+22670123456");
  assert.equal(normaliserNumero("+226 70 12 34 56"), "+22670123456");
  assert.equal(normaliserNumero("00226-70-12-34-56"), null, "l'indicatif international double n'est pas gere");
});

test("un numero de longueur incorrecte est refuse", async () => {
  assert.equal(normaliserNumero("123"), null);
  assert.equal(normaliserNumero("701234567890"), null);
  assert.equal(normaliserNumero(""), null);
  assert.equal(normaliserNumero(null), null);
});

test("seuls les operateurs connus passent", async () => {
  assert.equal(operateurValide("orange"), true);
  assert.equal(operateurValide("moov"), true);
  assert.equal(operateurValide("wave"), true);
  assert.equal(operateurValide("carte-bancaire"), false);
});

test("le fournisseur par defaut est la simulation", async () => {
  const fournisseur = fournisseurActif();
  assert.equal(fournisseur.estSimulation, true);
});

/* -------------------------------- signature ----------------------------- */

test("une notification signee est acceptee, une autre non", async () => {
  const corps = JSON.stringify({ reference: "FZ-1", status: "success" });
  const bonne = crypto.createHmac("sha256", "secret-partage").update(corps).digest("hex");

  assert.equal(agregateur.verifierSignature(corps, bonne), true);
  assert.equal(agregateur.verifierSignature(corps, "0".repeat(64)), false);
  assert.equal(agregateur.verifierSignature(corps, null), false);
  assert.equal(agregateur.verifierSignature(corps, bonne.slice(0, 32)), false);
});

test("modifier le corps invalide la signature", async () => {
  const corps = JSON.stringify({ reference: "FZ-1", status: "failed" });
  const signature = crypto.createHmac("sha256", "secret-partage").update(corps).digest("hex");
  const falsifie = JSON.stringify({ reference: "FZ-1", status: "success" });

  assert.equal(agregateur.verifierSignature(falsifie, signature), false);
});

/* --------------------------------- achats ------------------------------- */

async function paiement(type, montant, trackId = null) {
  return await creerPaiement({
    userId: auditeur.id,
    artistId: artiste.id,
    trackId,
    type,
    montant,
    operateur: "orange",
    numero: "+22670123456",
    provider: "simulation",
  });
}

test("un paiement nait en attente, avec une reference unique", async () => {
  const premier = await paiement("achat", 1000, morceau.id);
  const second = await paiement("pourboire", 500);

  assert.equal(premier.status, "attente");
  assert.match(premier.reference, /^FZ-\d{8}-[A-Z0-9]{6}$/);
  assert.notEqual(premier.reference, second.reference);
});

test("un achat n'ouvre le telechargement qu'une fois paye", async () => {
  const achat = await paiement("achat", 1000, morceau.id);
  assert.equal(await aAchete(auditeur.id, morceau.id), false);

  await conclurePaiement(achat.id, "paye");
  assert.equal(await aAchete(auditeur.id, morceau.id), true);
});

test("un achat echoue n'ouvre rien", async () => {
  const autreAuditeur = await createUser({
    name: "Issa",
    email: "issa@test.bf",
    password: "motdepasse123",
  });
  const achat = await creerPaiement({
    userId: autreAuditeur.id,
    artistId: artiste.id,
    trackId: morceau.id,
    type: "achat",
    montant: 1000,
    operateur: "moov",
    numero: "+22670000000",
    provider: "simulation",
  });

  await conclurePaiement(achat.id, "echoue");
  assert.equal(await aAchete(autreAuditeur.id, morceau.id), false);
});

test("un paiement deja paye ne peut pas etre redefait", async () => {
  const achat = await paiement("achat", 1000, morceau.id);
  await conclurePaiement(achat.id, "paye");
  const premierHorodatage = (await paiementParReference(achat.reference)).paid_at;

  // Une notification en double ou en retard ne doit rien changer.
  await conclurePaiement(achat.id, "echoue");
  const relu = await paiementParReference(achat.reference);

  assert.equal(relu.status, "paye");
  assert.equal(
    relu.paid_at.getTime(),
    premierHorodatage.getTime(),
    "l'horodatage du premier reglement est conserve",
  );
});

test("les revenus separent ventes et soutiens, et retiennent la commission", async () => {
  const frais = await getArtistByUserId(
    (await createUser({
      name: "Bobo Kanou",
      email: "bobo2@test.bf",
      password: "motdepasse123",
      role: "artiste",
    })).id,
  );

  const vente = await creerPaiement({
    userId: auditeur.id, artistId: frais.id, trackId: null, type: "achat",
    montant: 1000, operateur: "orange", numero: "+22670123456", provider: "simulation",
  });
  const soutien = await creerPaiement({
    userId: auditeur.id, artistId: frais.id, trackId: null, type: "pourboire",
    montant: 4000, operateur: "wave", numero: "+22670123456", provider: "simulation",
  });
  const perdu = await creerPaiement({
    userId: auditeur.id, artistId: frais.id, trackId: null, type: "pourboire",
    montant: 9000, operateur: "wave", numero: "+22670123456", provider: "simulation",
  });

  await conclurePaiement(vente.id, "paye");
  await conclurePaiement(soutien.id, "paye");
  await conclurePaiement(perdu.id, "echoue");

  const revenus = await revenusArtiste(frais.id);
  assert.equal(revenus.brut, 5000, "un paiement echoue ne compte pas");
  assert.equal(revenus.achats, 1000);
  assert.equal(revenus.pourboires, 4000);
  assert.equal(revenus.commission, 500);
  assert.equal(revenus.net, 4500);
  assert.equal(revenus.operations, 2);
});

test("la simulation est refusee en production sans autorisation explicite", async () => {
  const { fournisseurActif, PaiementIndisponible } = await import("@/lib/paiement");
  const environnementInitial = process.env.NODE_ENV;

  try {
    process.env.NODE_ENV = "production";
    delete process.env.PAIEMENT_SIMULATION_AUTORISEE;

    // Sans ce garde-fou, un site mis en ligne sans prestataire configure
    // laisserait chaque acheteur declarer son propre paiement recu.
    assert.throws(() => fournisseurActif(), PaiementIndisponible);

    process.env.PAIEMENT_SIMULATION_AUTORISEE = "oui";
    assert.equal(fournisseurActif().estSimulation, true, "l'autorisation explicite la reactive");
  } finally {
    process.env.NODE_ENV = environnementInitial;
    delete process.env.PAIEMENT_SIMULATION_AUTORISEE;
  }
});

test("un fournisseur inconnu est refuse et nomme les valeurs possibles", async () => {
  const { fournisseurActif } = await import("@/lib/paiement");
  const initial = process.env.PAIEMENT_FOURNISSEUR;

  try {
    process.env.PAIEMENT_FOURNISSEUR = "carte-bleue";
    assert.throws(() => fournisseurActif(), /simulation, agregateur/);
  } finally {
    if (initial === undefined) delete process.env.PAIEMENT_FOURNISSEUR;
    else process.env.PAIEMENT_FOURNISSEUR = initial;
  }
});
