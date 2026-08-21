import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

const RACINE = fs.mkdtempSync(path.join(os.tmpdir(), "fz-transcode-"));
process.env.MEDIA_ROOT = RACINE;

const { ffmpegDisponible, analyser, versionEcouteAudio, afficheVideo, versionsHls } = await import(
  "@/lib/transcode"
);

const AVEC_FFMPEG = await ffmpegDisponible();
// ffmpeg est facultatif : sans lui le site sert les fichiers d'origine. Les
// tests qui en dependent sont ecartes plutot que mis en echec.
const options = { skip: AVEC_FFMPEG ? false : "ffmpeg absent de cette machine" };

function fabriquer(nom, arguments_) {
  const cible = path.join(RACINE, nom);
  fs.mkdirSync(path.dirname(cible), { recursive: true });
  execFileSync("ffmpeg", ["-nostdin", "-y", ...arguments_, cible], { stdio: "ignore" });
  return nom;
}

test("un WAV est analyse : duree, absence de piste video", options, async () => {
  const source = fabriquer("audio/source.wav", [
    "-f", "lavfi", "-i", "sine=frequency=440", "-t", "5",
  ]);
  const info = await analyser(source);

  assert.equal(info.duration, 5);
  assert.equal(info.hasVideo, false);
  assert.equal(info.height, null);
});

test("la version d'ecoute est un MP3 nettement plus leger", options, async () => {
  const source = fabriquer("audio/lourd.wav", [
    "-f", "lavfi", "-i", "sine=frequency=440", "-t", "10",
  ]);
  const poidsSource = fs.statSync(path.join(RACINE, source)).size;
  const apercu = await versionEcouteAudio(source);

  assert.equal(apercu.mime, "audio/mpeg");
  assert.ok(apercu.relativePath.endsWith(".mp3"));
  assert.ok(
    apercu.size < poidsSource / 2,
    `attendu au moins deux fois plus leger : ${poidsSource} -> ${apercu.size}`,
  );
  assert.ok(fs.existsSync(path.join(RACINE, apercu.relativePath)));
});

test("un clip est analyse avec sa definition", options, async () => {
  const source = fabriquer("video/clip.mp4", [
    "-f", "lavfi", "-i", "testsrc2=size=1280x720:rate=25",
    "-f", "lavfi", "-i", "sine=frequency=440",
    "-t", "4", "-c:v", "libx264", "-preset", "ultrafast", "-c:a", "aac", "-shortest",
  ]);
  const info = await analyser(source);

  assert.equal(info.hasVideo, true);
  assert.equal(info.width, 1280);
  assert.equal(info.height, 720);
});

test("le decoupage HLS produit une playlist maitresse et des segments", options, async () => {
  const source = fabriquer("video/hls.mp4", [
    "-f", "lavfi", "-i", "testsrc2=size=1280x720:rate=25",
    "-f", "lavfi", "-i", "sine=frequency=440",
    "-t", "8", "-c:v", "libx264", "-preset", "ultrafast", "-c:a", "aac", "-shortest",
  ]);
  const hls = await versionsHls(source, { hauteurSource: 720 });
  const dossier = path.join(RACINE, hls.relativePath);

  const master = fs.readFileSync(path.join(dossier, "master.m3u8"), "utf8");
  assert.match(master, /#EXTM3U/);
  assert.match(master, /RESOLUTION=640x360/);
  assert.match(master, /RESOLUTION=1280x720/);

  const segments = fs.readdirSync(path.join(dossier, "360")).filter((f) => f.endsWith(".ts"));
  assert.ok(segments.length > 0, "la definition la plus basse doit avoir des segments");
  assert.ok(hls.poids360 > 0, "le poids de la definition basse doit etre mesure");
});

test("une source deja petite n'est pas agrandie en 720p", options, async () => {
  const source = fabriquer("video/petit.mp4", [
    "-f", "lavfi", "-i", "testsrc2=size=480x270:rate=25",
    "-f", "lavfi", "-i", "sine=frequency=440",
    "-t", "4", "-c:v", "libx264", "-preset", "ultrafast", "-c:a", "aac", "-shortest",
  ]);
  const hls = await versionsHls(source, { hauteurSource: 270 });
  const master = fs.readFileSync(path.join(RACINE, hls.relativePath, "master.m3u8"), "utf8");

  assert.equal(master.includes("1280x720"), false);
  assert.equal(fs.existsSync(path.join(RACINE, hls.relativePath, "720")), false);
});

test("l'affiche du clip est une image", options, async () => {
  const source = fabriquer("video/affiche.mp4", [
    "-f", "lavfi", "-i", "testsrc2=size=1280x720:rate=25",
    "-t", "5", "-c:v", "libx264", "-preset", "ultrafast",
  ]);
  const affiche = await afficheVideo(source);

  assert.ok(affiche.endsWith(".jpg"));
  assert.ok(fs.statSync(path.join(RACINE, affiche)).size > 1000);
});
