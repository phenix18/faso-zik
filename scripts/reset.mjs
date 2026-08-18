/** Efface la base et les medias de developpement. */
import fs from "node:fs";
import path from "node:path";

const dbFile = process.env.DATABASE_FILE || path.join(process.cwd(), "data", "faso-zik.db");
const mediaRoot = process.env.MEDIA_ROOT || path.join(process.cwd(), "storage", "media");

for (const suffix of ["", "-wal", "-shm", "-journal"]) {
  fs.rmSync(`${dbFile}${suffix}`, { force: true });
}
for (const kind of ["audio", "video", "image"]) {
  fs.rmSync(path.join(mediaRoot, kind), { recursive: true, force: true });
}
console.log("Base et medias effaces.");
