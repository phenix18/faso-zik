/**
 * Sauvegarde de la base et des medias.
 *
 * La base est copiee par l'API de sauvegarde de SQLite et non par `cp` :
 * copier le fichier pendant qu'une ecriture est en cours donnerait une archive
 * corrompue.
 *
 *   node scripts/backup.mjs [dossier-de-destination]
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import Database from "better-sqlite3";

const DB_FILE = process.env.DATABASE_FILE || path.join(process.cwd(), "data", "faso-zik.db");
const MEDIA_ROOT = process.env.MEDIA_ROOT || path.join(process.cwd(), "storage", "media");
const DESTINATION = process.argv[2] || path.join(process.cwd(), "sauvegardes");

const horodatage = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const dossier = path.join(DESTINATION, horodatage);
fs.mkdirSync(dossier, { recursive: true });

if (!fs.existsSync(DB_FILE)) {
  console.error(`Base introuvable : ${DB_FILE}`);
  process.exit(1);
}

const db = new Database(DB_FILE, { readonly: true });
await db.backup(path.join(dossier, "faso-zik.db"));
db.close();
console.log(`Base sauvegardee dans ${dossier}/faso-zik.db`);

if (fs.existsSync(MEDIA_ROOT)) {
  const archive = path.join(dossier, "medias.tar.gz");
  execFileSync("tar", ["-czf", archive, "-C", path.dirname(MEDIA_ROOT), path.basename(MEDIA_ROOT)]);
  const taille = (fs.statSync(archive).size / 1048576).toFixed(1);
  console.log(`Medias archives dans ${archive} (${taille} Mo)`);
}

console.log("\nA copier hors de la machine : une sauvegarde restee sur le meme disque");
console.log("ne protege de rien.");
