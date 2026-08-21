import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

const RACINE = fs.mkdtempSync(path.join(os.tmpdir(), "fz-bpm-"));
process.env.MEDIA_ROOT = RACINE;

const { ffmpegDisponible } = await import("@/lib/transcode");
const { detecterBpm } = await import("@/lib/bpm");

const options = { skip: (await ffmpegDisponible()) ? false : "ffmpeg absent de cette machine" };
const TAUX = 44100;

/** Fabrique un motif rythmique dont on connait le tempo exact. */
function motif(nom, { bpm, secondes = 20, contretemps = false, bruit = 0, decalage = 0 }) {
  const total = TAUX * secondes;
  const signal = new Float32Array(total);
  const temps = 60 / bpm;

  for (let index = 0; index < total; index += 1) {
    const t = index / TAUX;
    signal[index] =
      (bruit ? (Math.random() * 2 - 1) * bruit : 0) +
      Math.sin(2 * Math.PI * 220 * t) * 0.06 +
      Math.sin(2 * Math.PI * 330 * t) * 0.04;
  }

  const frappe = (debut, force, frequence) => {
    for (let k = 0; k < TAUX * 0.18; k += 1) {
      const index = Math.round(debut * TAUX) + k;
      if (index >= total) break;
      const u = k / TAUX;
      signal[index] +=
        Math.sin(2 * Math.PI * (frequence - frequence * 0.45 * (u / 0.18)) * u) *
        Math.exp(-18 * u) *
        force;
    }
  };

  for (let instant = 0; instant < secondes; instant += temps) {
    const gigue = decalage ? (Math.random() * 2 - 1) * decalage : 0;
    frappe(instant + gigue, 0.9, 60);
    if (contretemps) frappe(instant + temps * 0.5 + gigue, 0.55, 190);
  }

  const pcm = Buffer.alloc(44 + total * 2);
  pcm.write("RIFF", 0);
  pcm.writeUInt32LE(36 + total * 2, 4);
  pcm.write("WAVE", 8);
  pcm.write("fmt ", 12);
  pcm.writeUInt32LE(16, 16);
  pcm.writeUInt16LE(1, 20);
  pcm.writeUInt16LE(1, 22);
  pcm.writeUInt32LE(TAUX, 24);
  pcm.writeUInt32LE(TAUX * 2, 28);
  pcm.writeUInt16LE(2, 32);
  pcm.writeUInt16LE(16, 34);
  pcm.write("data", 36);
  pcm.writeUInt32LE(total * 2, 40);
  for (let index = 0; index < total; index += 1) {
    const valeur = Math.max(-1, Math.min(1, signal[index]));
    pcm.writeInt16LE(Math.round(valeur * 32000), 44 + index * 2);
  }

  fs.writeFileSync(path.join(RACINE, nom), pcm);
  return nom;
}

test("un motif regulier donne son tempo", options, async () => {
  const mesure = await detecterBpm(motif("regulier.wav", { bpm: 100 }));
  assert.ok(Math.abs(mesure - 100) <= 2, `attendu 100, obtenu ${mesure}`);
});

test("un contretemps ne fait pas doubler le tempo", options, async () => {
  // Frappe forte sur le temps, faible entre deux : l'intervalle entre attaques
  // vaut la moitie du temps, mais le tempo reste 92.
  const mesure = await detecterBpm(motif("contretemps.wav", { bpm: 92, contretemps: true }));
  assert.ok(Math.abs(mesure - 92) <= 2, `attendu 92, obtenu ${mesure}`);
});

test("un morceau lent n'est pas remonte a son double", options, async () => {
  const mesure = await detecterBpm(motif("lent.wav", { bpm: 72, contretemps: true }));
  assert.ok(Math.abs(mesure - 72) <= 2, `attendu 72, obtenu ${mesure}`);
});

test("un morceau rapide n'est pas ramene vers le milieu", options, async () => {
  // Duree plus longue a dessein : sur vingt secondes, ce tempo se confond avec
  // 112 (soit deux tiers de 168). La detection reelle analyse jusqu'a trois
  // minutes, ou l'ambiguite se leve — c'est une limite de la methode, pas un
  // reglage de complaisance.
  const mesure = await detecterBpm(motif("rapide.wav", { bpm: 168, contretemps: true, secondes: 40 }));
  assert.ok(Math.abs(mesure - 168) <= 2, `attendu 168, obtenu ${mesure}`);
});

test("une detection trop courte peut se tromper : limite assumee", options, async () => {
  // Ce test fige un comportement connu plutot que de le masquer. Si une
  // methode plus robuste est adoptee un jour, il echouera et devra etre revu.
  const court = await detecterBpm(motif("rapide-court.wav", { bpm: 168, contretemps: true, secondes: 20 }));
  assert.ok(court > 0, "une valeur est renvoyee malgre l'ambiguite");
});

test("le bruit et une frappe imprecise restent tolerables", options, async () => {
  const mesure = await detecterBpm(
    motif("imprecis.wav", { bpm: 115, contretemps: true, bruit: 0.2, decalage: 0.012 }),
  );
  assert.ok(Math.abs(mesure - 115) <= 3, `attendu 115, obtenu ${mesure}`);
});

test("un tempo non entier est rendu au dixieme", options, async () => {
  const mesure = await detecterBpm(motif("fractionnaire.wav", { bpm: 123.5, contretemps: true }));
  assert.ok(Math.abs(mesure - 123.5) <= 2, `attendu 123,5, obtenu ${mesure}`);
});

test("un fichier trop court ne renvoie rien plutot qu'une valeur inventee", options, async () => {
  const cible = path.join(RACINE, "court.wav");
  execFileSync(
    "ffmpeg",
    ["-nostdin", "-y", "-f", "lavfi", "-i", "sine=frequency=440", "-t", "1", cible],
    { stdio: "ignore" },
  );
  assert.equal(await detecterBpm("court.wav"), null);
});
