import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// Le module lit son environnement au chargement : on le regle avant d'importer.
const RACINE = fs.mkdtempSync(path.join(os.tmpdir(), "fz-media-"));
process.env.MEDIA_ROOT = RACINE;
process.env.MAX_AUDIO_MB = "1";

const { MEDIA_ROOT, resolveMedia, saveUpload, removeMedia, extensionFor } = await import(
  "@/lib/storage"
);

test("la racine des medias est celle de l'environnement", () => {
  assert.equal(MEDIA_ROOT, RACINE);
});

test("un chemin relatif normal est resolu dans la racine", () => {
  const resolu = resolveMedia("audio/morceau.mp3");
  assert.equal(resolu, path.join(RACINE, "audio", "morceau.mp3"));
});

test("toute sortie de la racine est refusee", () => {
  for (const chemin of [
    "../secret",
    "audio/../../secret",
    "../../../../etc/passwd",
    "audio/../../../etc/passwd",
  ]) {
    assert.throws(() => resolveMedia(chemin), /invalide/, `${chemin} aurait du etre refuse`);
  }
});

test("un chemin absolu ne permet pas de sortir non plus", () => {
  assert.throws(() => resolveMedia("/etc/passwd"), /invalide/);
});

test("l'extension suit le type declare, sinon le nom du fichier", () => {
  assert.equal(extensionFor("audio/mpeg"), ".mp3");
  assert.equal(extensionFor("video/mp4"), ".mp4");
  assert.equal(extensionFor("application/inconnu", "morceau.opus"), ".opus");
  assert.equal(extensionFor("application/inconnu"), ".bin");
});

test("un fichier accepte est ecrit sous la racine", async () => {
  const fichier = new File([Buffer.alloc(1024, 7)], "essai.mp3", { type: "audio/mpeg" });
  const { relativePath, size, mime } = await saveUpload(fichier, "audio");

  assert.equal(mime, "audio/mpeg");
  assert.equal(size, 1024);
  assert.ok(relativePath.startsWith("audio"), "le fichier va dans le sous-dossier du type");
  assert.ok(relativePath.endsWith(".mp3"));
  assert.equal(fs.statSync(path.join(RACINE, relativePath)).size, 1024);

  await removeMedia(relativePath);
  assert.equal(fs.existsSync(path.join(RACINE, relativePath)), false);
});

test("un type non accepte est refuse", async () => {
  const fichier = new File([Buffer.alloc(16)], "charge.exe", { type: "application/x-msdownload" });
  await assert.rejects(() => saveUpload(fichier, "audio"), /Format non accepte/);
});

test("une video deposee comme audio est refusee", async () => {
  const fichier = new File([Buffer.alloc(16)], "clip.mp4", { type: "video/mp4" });
  await assert.rejects(() => saveUpload(fichier, "audio"), /Format non accepte/);
});

test("un fichier au-dela de la limite est refuse", async () => {
  const fichier = new File([Buffer.alloc(2 * 1024 * 1024)], "gros.mp3", { type: "audio/mpeg" });
  await assert.rejects(() => saveUpload(fichier, "audio"), /trop volumineux/);
});

test("supprimer un fichier absent ne leve pas d'erreur", async () => {
  await removeMedia("audio/inexistant.mp3");
});
