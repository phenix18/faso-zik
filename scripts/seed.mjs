/**
 * Jeu de demonstration FASO-ZIK.
 *
 * Le script fabrique aussi les fichiers audio (WAV de synthese, tempos
 * differents) et les depose au stockage : le catalogue, le lecteur et la
 * platine sont utilisables immediatement apres l'installation, sans avoir a
 * fournir de la musique.
 *
 *   npm run seed
 */
import bcrypt from "bcryptjs";
import { execute, fermerDb, unique } from "../src/lib/db/index.js";
import { newId, slugify } from "../src/lib/ids.js";
import { deposerObjet, stockageConfigure } from "../src/lib/storage.js";

const SAMPLE_RATE = 44100;

const ARTISTES = [
  {
    name: "Yennenga Sound",
    email: "yennenga@faso-zik.bf",
    city: "Ouagadougou",
    genres: "Afrobeat, Balafon moderne",
    bio: "Collectif ouagalais qui melange balafon mandingue et rythmiques afrobeat.",
    verified: true,
  },
  {
    name: "Bobo Kanou",
    email: "bobo.kanou@faso-zik.bf",
    city: "Bobo-Dioulasso",
    genres: "Coupe-decale, Zouglou",
    bio: "Voix de Bobo-Dioulasso, entre coupe-decale et refrains en dioula.",
    verified: false,
  },
  {
    name: "Sahel Digital",
    email: "sahel.digital@faso-zik.bf",
    city: "Ouahigouya",
    genres: "Electro sahelienne",
    bio: "Productrice electro qui echantillonne les percussions du Yatenga.",
    verified: true,
  },
];

const TITRES = [
  { artiste: 0, titre: "Faso Denya", genre: "Afrobeat", langue: "Dioula", bpm: 102, ton: "Am", telechargeable: true, platine: true },
  { artiste: 0, titre: "Balafon Sunrise", genre: "Balafon moderne", langue: "Instrumental", bpm: 96, ton: "C", telechargeable: false, platine: true },
  { artiste: 1, titre: "Ouaga la Nuit", genre: "Coupe-decale", langue: "Francais", bpm: 124, ton: "Gm", telechargeable: true, platine: true },
  { artiste: 1, titre: "Kanou Kanou", genre: "Zouglou", langue: "Dioula", bpm: 118, ton: "Dm", telechargeable: false, platine: false },
  { artiste: 2, titre: "Yatenga Circuit", genre: "Electro sahelienne", langue: "Instrumental", bpm: 128, ton: "Fm", telechargeable: true, platine: true },
  { artiste: 2, titre: "Harmattan", genre: "Electro sahelienne", langue: "Instrumental", bpm: 110, ton: "Em", telechargeable: false, platine: true },
];

// Les deux premiers titres de Yennenga Sound forment un EP.
const ALBUMS = [
  {
    artiste: 0,
    titre: "Racines de Ouaga",
    kind: "ep",
    description: "Deux morceaux enregistres entre balafon et machines.",
    titres: ["Faso Denya", "Balafon Sunrise"],
  },
];

/* --------------------------- synthese audio ---------------------------- */

function encoderWav(echantillons) {
  const buffer = Buffer.alloc(44 + echantillons.length * 2);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + echantillons.length * 2, 4);
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
  buffer.writeUInt32LE(echantillons.length * 2, 40);

  for (let index = 0; index < echantillons.length; index += 1) {
    const valeur = Math.max(-1, Math.min(1, echantillons[index]));
    buffer.writeInt16LE(Math.round(valeur * 32767), 44 + index * 2);
  }
  return buffer;
}

/** Boucle kick + basse + nappe, calee sur le BPM annonce du morceau. */
function synthetiser({ bpm, secondes = 24, fondamentale = 110 }) {
  const total = SAMPLE_RATE * secondes;
  const echantillons = new Float32Array(total);
  const temps = 60 / bpm;
  const notes = [1, 1.5, 1.2, 0.75];

  for (let index = 0; index < total; index += 1) {
    const t = index / SAMPLE_RATE;
    const position = (t / temps) % 1;
    const numero = Math.floor(t / temps);

    const kick =
      Math.sin(2 * Math.PI * (55 - 25 * position) * t) * Math.exp(-14 * position) * 0.85;

    const frequence = fondamentale * notes[numero % notes.length];
    const basse = Math.sin(2 * Math.PI * frequence * t) * 0.18 * (1 - position * 0.4);
    const nappe =
      (Math.sin(2 * Math.PI * frequence * 2 * t) + Math.sin(2 * Math.PI * frequence * 3.01 * t)) *
      0.05;
    const charley =
      position > 0.5 && position < 0.56
        ? (Math.random() * 2 - 1) * 0.12 * Math.exp(-40 * (position - 0.5))
        : 0;

    const fondu = Math.min(t / 0.3, 1) * Math.min((secondes - t) / 0.5, 1);
    echantillons[index] = (kick + basse + nappe + charley) * fondu;
  }
  return encoderWav(echantillons);
}

/* ------------------------------ insertion ------------------------------ */

if (!stockageConfigure()) {
  console.error(
    "Stockage non configure : renseignez SUPABASE_URL et SUPABASE_SERVICE_KEY,",
    "\nou S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID et S3_SECRET_ACCESS_KEY.",
  );
  console.error("Le catalogue de demonstration a besoin d'un endroit ou deposer ses fichiers.");
  process.exit(1);
}

const motDePasse = bcrypt.hashSync("fasozik2024", 10);
const identifiants = [];

for (const artiste of ARTISTES) {
  const slug = slugify(artiste.name);
  const existant = await unique("SELECT id FROM artists WHERE slug = $1", [slug]);

  if (existant) {
    identifiants.push(existant.id);
    console.log(`= ${artiste.name} existe deja`);
    continue;
  }

  const userId = newId("usr");
  const artistId = newId("art");
  await execute(
    "INSERT INTO users (id, name, email, password_hash, role) VALUES ($1,$2,$3,$4,'artiste')",
    [userId, artiste.name, artiste.email, motDePasse],
  );
  await execute(
    `INSERT INTO artists (id, user_id, name, slug, bio, city, genres, verified)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [artistId, userId, artiste.name, slug, artiste.bio, artiste.city, artiste.genres, artiste.verified],
  );

  identifiants.push(artistId);
  console.log(`+ artiste ${artiste.name} (${artiste.email} / fasozik2024)`);
}

for (const titre of TITRES) {
  const artistId = identifiants[titre.artiste];
  const slug = slugify(titre.titre);

  if (await unique("SELECT 1 FROM tracks WHERE artist_id = $1 AND slug = $2", [artistId, slug])) {
    console.log(`= ${titre.titre} existe deja`);
    continue;
  }

  const audio = synthetiser({ bpm: titre.bpm, fondamentale: 90 + titre.bpm / 3 });
  const chemin = `audio/${slug}-${newId()}.wav`;
  await deposerObjet(chemin, audio, "audio/wav");

  await execute(
    `INSERT INTO tracks (
        id, artist_id, title, slug, kind, genre, language, description,
        duration, bpm, music_key, media_path, media_mime, media_size,
        allow_stream, allow_download, allow_dj, license, rights_confirmed, published, plays
     ) VALUES ($1,$2,$3,$4,'audio',$5,$6,$7,24,$8,$9,$10,'audio/wav',$11,TRUE,$12,$13,$14,TRUE,TRUE,$15)`,
    [
      newId("trk"),
      artistId,
      titre.titre,
      slug,
      titre.genre,
      titre.langue,
      "Maquette de demonstration generee pour tester le lecteur et la platine.",
      titre.bpm,
      titre.ton,
      chemin,
      audio.length,
      titre.telechargeable,
      titre.platine,
      "Demonstration FASO-ZIK",
      Math.floor(Math.random() * 900),
    ],
  );
  console.log(`+ titre ${titre.titre} (${titre.bpm} BPM)`);
}

for (const album of ALBUMS) {
  const artistId = identifiants[album.artiste];
  const slug = slugify(album.titre);
  let ligne = await unique("SELECT id FROM albums WHERE artist_id = $1 AND slug = $2", [
    artistId,
    slug,
  ]);

  if (!ligne) {
    const id = newId("alb");
    await execute(
      `INSERT INTO albums (id, artist_id, title, slug, kind, description)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [id, artistId, album.titre, slug, album.kind, album.description],
    );
    ligne = { id };
    console.log(`+ album ${album.titre}`);
  }

  for (const [rang, titre] of album.titres.entries()) {
    await execute(
      "UPDATE tracks SET album_id = $1, track_no = $2 WHERE artist_id = $3 AND title = $4",
      [ligne.id, rang + 1, artistId, titre],
    );
  }
}

await fermerDb();
console.log("\nCatalogue de demonstration pret. Comptes artistes : mot de passe fasozik2024");
