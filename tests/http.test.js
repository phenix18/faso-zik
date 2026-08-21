import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { isFirstRequest, rangeResponse } from "@/lib/http";

const CONTENU = Buffer.from("0123456789ABCDEFGHIJ"); // 20 octets
const FICHIER = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "fz-http-")), "media.bin");
fs.writeFileSync(FICHIER, CONTENU);
const STAT = fs.statSync(FICHIER);

function reponse(range, options) {
  return rangeResponse(FICHIER, STAT, "audio/mpeg", range, options);
}

test("sans en-tete Range : 200 et fichier entier", async () => {
  const r = reponse(null);
  assert.equal(r.status, 200);
  assert.equal(r.headers.get("content-length"), "20");
  assert.equal(r.headers.get("accept-ranges"), "bytes");
  assert.equal(await r.text(), CONTENU.toString());
});

test("plage explicite : 206 et Content-Range exact", async () => {
  const r = reponse("bytes=5-9");
  assert.equal(r.status, 206);
  assert.equal(r.headers.get("content-range"), "bytes 5-9/20");
  assert.equal(r.headers.get("content-length"), "5");
  assert.equal(await r.text(), "56789");
});

test("plage ouverte a droite : va jusqu'a la fin", async () => {
  const r = reponse("bytes=15-");
  assert.equal(r.status, 206);
  assert.equal(r.headers.get("content-range"), "bytes 15-19/20");
  assert.equal(await r.text(), "FGHIJ");
});

test("forme suffixe : les N derniers octets", async () => {
  const r = reponse("bytes=-4");
  assert.equal(r.status, 206);
  assert.equal(r.headers.get("content-range"), "bytes 16-19/20");
  assert.equal(await r.text(), "GHIJ");
});

test("suffixe plus grand que le fichier : tout le fichier", async () => {
  const r = reponse("bytes=-500");
  assert.equal(r.headers.get("content-range"), "bytes 0-19/20");
});

test("fin au-dela de la taille : ramenee au dernier octet", async () => {
  const r = reponse("bytes=18-999");
  assert.equal(r.headers.get("content-range"), "bytes 18-19/20");
});

test("debut hors limites : 416 avec la taille reelle", () => {
  const r = reponse("bytes=99-");
  assert.equal(r.status, 416);
  assert.equal(r.headers.get("content-range"), "bytes */20");
});

test("plage inversee : 416", () => {
  assert.equal(reponse("bytes=9-3").status, 416);
});

test("en-tete Range illisible : traite comme une requete complete", () => {
  assert.equal(reponse("octets=0-5").status, 200);
  assert.equal(reponse("bytes=abc").status, 200);
});

test("le nom de fichier est echappe et encode", () => {
  const r = reponse(null, { filename: 'Faso "Denya".mp3', disposition: "attachment" });
  const entete = r.headers.get("content-disposition");
  assert.ok(entete.startsWith("attachment;"));
  assert.ok(!entete.includes('"Denya"'), "les guillemets doivent etre retires");
  assert.ok(entete.includes("filename*=UTF-8''"), "la forme encodee doit etre presente");
});

test("seule une requete depuis le debut compte comme une ecoute", () => {
  assert.equal(isFirstRequest(null), true);
  assert.equal(isFirstRequest("bytes=0-"), true);
  assert.equal(isFirstRequest("bytes=-100"), true);
  assert.equal(isFirstRequest("bytes=4096-"), false);
});
