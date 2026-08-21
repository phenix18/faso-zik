/**
 * Fabrique les icones de l'application : carre bicolore aux couleurs du
 * drapeau burkinabe, etoile doree au centre.
 *
 * Les PNG sont ecrits a la main (zlib + chunks) pour ne pas ajouter une
 * bibliotheque graphique a un projet qui n'en a pas besoin ailleurs.
 *
 *   node scripts/generate-icons.mjs
 */
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const ROUGE = [0xef, 0x33, 0x40];
const VERT = [0x12, 0xa2, 0x4a];
const OR = [0xfc, 0xd1, 0x16];

/** Sommets d'une etoile a cinq branches inscrite dans un cercle. */
function etoile(cx, cy, rayonExterne, rayonInterne) {
  const points = [];
  for (let index = 0; index < 10; index += 1) {
    const rayon = index % 2 === 0 ? rayonExterne : rayonInterne;
    const angle = (Math.PI / 5) * index - Math.PI / 2;
    points.push([cx + rayon * Math.cos(angle), cy + rayon * Math.sin(angle)]);
  }
  return points;
}

/** Lancer de rayon horizontal : compte les traversees d'aretes. */
function dansPolygone(x, y, points) {
  let dedans = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [xi, yi] = points[i];
    const [xj, yj] = points[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      dedans = !dedans;
    }
  }
  return dedans;
}

function png(taille) {
  const branches = etoile(taille / 2, taille / 2, taille * 0.26, taille * 0.11);
  const rayon = taille * 0.18; // coins arrondis
  const brut = Buffer.alloc(taille * (taille * 4 + 1));
  let position = 0;

  for (let y = 0; y < taille; y += 1) {
    brut[position++] = 0; // filtre "none" en tete de ligne
    for (let x = 0; x < taille; x += 1) {
      // Hors du carre arrondi : transparent.
      const dx = Math.max(rayon - x, x - (taille - rayon), 0);
      const dy = Math.max(rayon - y, y - (taille - rayon), 0);
      const dehors = Math.hypot(dx, dy) > rayon;

      let couleur = y < taille / 2 ? ROUGE : VERT;
      if (dansPolygone(x + 0.5, y + 0.5, branches)) couleur = OR;

      brut[position++] = couleur[0];
      brut[position++] = couleur[1];
      brut[position++] = couleur[2];
      brut[position++] = dehors ? 0 : 255;
    }
  }

  const chunk = (type, donnees) => {
    const longueur = Buffer.alloc(4);
    longueur.writeUInt32BE(donnees.length);
    const corps = Buffer.concat([Buffer.from(type, "ascii"), donnees]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(zlib.crc32 ? zlib.crc32(corps) : crc32(corps));
    return Buffer.concat([longueur, corps, crc]);
  };

  const entete = Buffer.alloc(13);
  entete.writeUInt32BE(taille, 0);
  entete.writeUInt32BE(taille, 4);
  entete[8] = 8; // 8 bits par canal
  entete[9] = 6; // RVB + alpha

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", entete),
    chunk("IDAT", zlib.deflateSync(brut, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/** Repli pour les versions de Node sans zlib.crc32. */
function crc32(buffer) {
  let crc = 0xffffffff;
  for (const octet of buffer) {
    crc ^= octet;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

const DESTINATION = path.join(process.cwd(), "public");
fs.mkdirSync(DESTINATION, { recursive: true });

for (const taille of [192, 512]) {
  const fichier = path.join(DESTINATION, `icone-${taille}.png`);
  fs.writeFileSync(fichier, png(taille));
  console.log(`${fichier} (${taille}x${taille})`);
}

fs.writeFileSync(path.join(DESTINATION, "favicon.png"), png(64));
console.log(`${path.join(DESTINATION, "favicon.png")} (64x64)`);
