/**
 * Jeu de demonstration FASO-ZIK.
 *
 * Le script fabrique aussi les fichiers audio (WAV de synthese, tempos
 * differents) : le catalogue, le lecteur et la platine sont ainsi utilisables
 * immediatement apres l'installation, sans avoir a fournir de la musique.
 *
 *   npm run seed
 */
import fs from "node:fs";
import path from "node:path";
import bcrypt from "bcryptjs";
import { getDb } from "../src/lib/db.js";
import { newId, slugify } from "../src/lib/ids.js";

const MEDIA_ROOT = process.env.MEDIA_ROOT || path.join(process.cwd(), "storage", "media");
const SAMPLE_RATE = 44100;

const ARTISTS = [
  {
    name: "Yennenga Sound",
    email: "yennenga@faso-zik.bf",
    city: "Ouagadougou",
    genres: "Afrobeat, Balafon moderne",
    bio: "Collectif ouagalais qui melange balafon mandingue et rythmiques afrobeat.",
    verified: 1,
  },
  {
    name: "Bobo Kanou",
    email: "bobo.kanou@faso-zik.bf",
    city: "Bobo-Dioulasso",
    genres: "Coupe-decale, Zouglou",
    bio: "Voix de Bobo-Dioulasso, entre coupe-decale et refrains en dioula.",
    verified: 0,
  },
  {
    name: "Sahel Digital",
    email: "sahel.digital@faso-zik.bf",
    city: "Ouahigouya",
    genres: "Electro sahelienne",
    bio: "Productrice electro qui echantillonne les percussions du Yatenga.",
    verified: 1,
  },
];

// Les deux premiers titres de Yennenga Sound forment un EP.
const ALBUMS = [
  {
    artist: 0,
    titre: "Racines de Ouaga",
    kind: "ep",
    description: "Deux morceaux enregistres entre balafon et machines.",
    titres: ["Faso Denya", "Balafon Sunrise"],
  },
];

const TRACKS = [
  { artist: 0, title: "Faso Denya", genre: "Afrobeat", language: "Dioula", bpm: 102, key: "Am", allowDownload: 1, allowDj: 1 },
  { artist: 0, title: "Balafon Sunrise", genre: "Balafon moderne", language: "Instrumental", bpm: 96, key: "C", allowDownload: 0, allowDj: 1 },
  { artist: 1, title: "Ouaga la Nuit", genre: "Coupe-decale", language: "Francais", bpm: 124, key: "Gm", allowDownload: 1, allowDj: 1 },
  { artist: 1, title: "Kanou Kanou", genre: "Zouglou", language: "Dioula", bpm: 118, key: "Dm", allowDownload: 0, allowDj: 0 },
  { artist: 2, title: "Yatenga Circuit", genre: "Electro sahelienne", language: "Instrumental", bpm: 128, key: "Fm", allowDownload: 1, allowDj: 1 },
  { artist: 2, title: "Harmattan", genre: "Electro sahelienne", language: "Instrumental", bpm: 110, key: "Em", allowDownload: 0, allowDj: 1 },
];

/* --------------------------- synthese audio ---------------------------- */

function encodeWav(samples) {
  const buffer = Buffer.alloc(44 + samples.length * 2);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + samples.length * 2, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(1, 22); // mono
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(SAMPLE_RATE * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(samples.length * 2, 40);

  for (let index = 0; index < samples.length; index += 1) {
    const value = Math.max(-1, Math.min(1, samples[index]));
    buffer.writeInt16LE(Math.round(value * 32767), 44 + index * 2);
  }
  return buffer;
}

/** Boucle kick + basse + nappe, calee sur le BPM annonce du morceau. */
function synthesise({ bpm, seconds = 24, root = 110 }) {
  const total = SAMPLE_RATE * seconds;
  const samples = new Float32Array(total);
  const beat = 60 / bpm;
  const notes = [1, 1.5, 1.2, 0.75];

  for (let index = 0; index < total; index += 1) {
    const time = index / SAMPLE_RATE;
    const beatPosition = (time / beat) % 1;
    const beatNumber = Math.floor(time / beat);

    const kick =
      Math.sin(2 * Math.PI * (55 - 25 * beatPosition) * time) *
      Math.exp(-14 * beatPosition) *
      0.85;

    const frequency = root * notes[beatNumber % notes.length];
    const bass = Math.sin(2 * Math.PI * frequency * time) * 0.18 * (1 - beatPosition * 0.4);

    const pad =
      (Math.sin(2 * Math.PI * frequency * 2 * time) +
        Math.sin(2 * Math.PI * frequency * 3.01 * time)) *
      0.05;

    const hat =
      beatPosition > 0.5 && beatPosition < 0.56
        ? (Math.random() * 2 - 1) * 0.12 * Math.exp(-40 * (beatPosition - 0.5))
        : 0;

    const fade = Math.min(time / 0.3, 1) * Math.min((seconds - time) / 0.5, 1);
    samples[index] = (kick + bass + pad + hat) * fade;
  }
  return encodeWav(samples);
}

/* ------------------------------ insertion ------------------------------ */

const db = getDb();
fs.mkdirSync(path.join(MEDIA_ROOT, "audio"), { recursive: true });

const password = bcrypt.hashSync("fasozik2024", 10);
const artistIds = [];

for (const artist of ARTISTS) {
  const existing = db.prepare("SELECT id FROM artists WHERE slug = ?").get(slugify(artist.name));
  if (existing) {
    artistIds.push(existing.id);
    console.log(`= ${artist.name} existe deja`);
    continue;
  }

  const userId = newId("usr");
  const artistId = newId("art");
  db.prepare(
    "INSERT INTO users (id, name, email, password_hash, role) VALUES (?, ?, ?, ?, 'artiste')",
  ).run(userId, artist.name, artist.email, password);
  db.prepare(
    `INSERT INTO artists (id, user_id, name, slug, bio, city, genres, verified)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    artistId,
    userId,
    artist.name,
    slugify(artist.name),
    artist.bio,
    artist.city,
    artist.genres,
    artist.verified,
  );
  artistIds.push(artistId);
  console.log(`+ artiste ${artist.name} (${artist.email} / fasozik2024)`);
}

for (const track of TRACKS) {
  const artistId = artistIds[track.artist];
  const slug = slugify(track.title);
  if (db.prepare("SELECT 1 FROM tracks WHERE artist_id = ? AND slug = ?").get(artistId, slug)) {
    console.log(`= ${track.title} existe deja`);
    continue;
  }

  const relative = path.join("audio", `${slug}-${newId()}.wav`);
  const audio = synthesise({ bpm: track.bpm, root: 90 + track.bpm / 3 });
  fs.writeFileSync(path.join(MEDIA_ROOT, relative), audio);

  db.prepare(
    `INSERT INTO tracks (
        id, artist_id, title, slug, kind, genre, language, description,
        duration, bpm, music_key, media_path, media_mime, media_size,
        allow_stream, allow_download, allow_dj, license, rights_confirmed, published,
        transcode_status, plays
     ) VALUES (?,?,?,?,'audio',?,?,?,?,?,?,?,'audio/wav',?,1,?,?,?,1,1,'attente',?)`,
  ).run(
    newId("trk"),
    artistId,
    track.title,
    slug,
    track.genre,
    track.language,
    "Maquette de demonstration generee pour tester le lecteur et la platine.",
    24,
    track.bpm,
    track.key,
    relative,
    audio.length,
    track.allowDownload,
    track.allowDj,
    "Demonstration FASO-ZIK",
    Math.floor(Math.random() * 900),
  );
  console.log(`+ titre ${track.title} (${track.bpm} BPM)`);
}

for (const album of ALBUMS) {
  const artistId = artistIds[album.artist];
  const slug = slugify(album.titre);
  let ligne = db.prepare("SELECT id FROM albums WHERE artist_id = ? AND slug = ?").get(artistId, slug);

  if (!ligne) {
    const id = newId("alb");
    db.prepare(
      `INSERT INTO albums (id, artist_id, title, slug, kind, description)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(id, artistId, album.titre, slug, album.kind, album.description);
    ligne = { id };
    console.log(`+ album ${album.titre}`);
  }

  album.titres.forEach((titre, rang) => {
    db.prepare(
      "UPDATE tracks SET album_id = ?, track_no = ? WHERE artist_id = ? AND title = ?",
    ).run(ligne.id, rang + 1, artistId, titre);
  });
}

console.log("\nCatalogue de demonstration pret. Comptes artistes : mot de passe fasozik2024");
console.log("Les versions d'ecoute allegees se fabriquent au premier demarrage du site,");
console.log("si ffmpeg est installe.");
