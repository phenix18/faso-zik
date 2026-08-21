import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { newId } from "@/lib/ids";

/**
 * Stockage des medias sur disque.
 *
 * Un seul point d'entree pour ecrire et resoudre les fichiers : le chemin
 * enregistre en base est toujours relatif a MEDIA_ROOT et re-verifie avant
 * lecture, ce qui ferme la porte aux traversees de repertoire (../../etc).
 * Pour passer sur S3 / Cloudflare R2, seules ces fonctions changent.
 */

export const MEDIA_ROOT =
  process.env.MEDIA_ROOT || path.join(process.cwd(), "storage", "media");

export const LIMITS = {
  audio: Number(process.env.MAX_AUDIO_MB || 40) * 1024 * 1024,
  video: Number(process.env.MAX_VIDEO_MB || 400) * 1024 * 1024,
  image: Number(process.env.MAX_IMAGE_MB || 8) * 1024 * 1024,
};

const EXTENSIONS = {
  "audio/mpeg": ".mp3",
  "audio/mp3": ".mp3",
  "audio/wav": ".wav",
  "audio/x-wav": ".wav",
  "audio/flac": ".flac",
  "audio/ogg": ".ogg",
  "audio/aac": ".aac",
  "audio/mp4": ".m4a",
  "audio/x-m4a": ".m4a",
  "video/mp4": ".mp4",
  "video/webm": ".webm",
  "video/quicktime": ".mov",
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/avif": ".avif",
};

export const ACCEPTED = {
  audio: ["audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav", "audio/flac", "audio/ogg", "audio/aac", "audio/mp4", "audio/x-m4a"],
  video: ["video/mp4", "video/webm", "video/quicktime"],
  image: ["image/jpeg", "image/png", "image/webp", "image/avif"],
};

export function extensionFor(mime, fallbackName = "") {
  return EXTENSIONS[mime] || path.extname(fallbackName).toLowerCase() || ".bin";
}

/** Ecrit un File (Web API) dans storage/media/<kind>/ et renvoie son chemin relatif. */
export async function saveUpload(file, kind) {
  if (!ACCEPTED[kind]) throw new Error(`Type de media inconnu : ${kind}`);
  if (!ACCEPTED[kind].includes(file.type)) {
    throw new Error(`Format non accepte (${file.type || "inconnu"}) pour un fichier ${kind}.`);
  }
  if (file.size > LIMITS[kind]) {
    throw new Error(
      `Fichier trop volumineux : ${(file.size / 1048576).toFixed(1)} Mo, maximum ${(
        LIMITS[kind] / 1048576
      ).toFixed(0)} Mo.`,
    );
  }

  const relative = path.join(kind, `${newId()}${extensionFor(file.type, file.name)}`);
  const absolute = path.join(MEDIA_ROOT, relative);
  await fsp.mkdir(path.dirname(absolute), { recursive: true });
  await fsp.writeFile(absolute, Buffer.from(await file.arrayBuffer()));
  return { relativePath: relative, size: file.size, mime: file.type };
}

/** Resout un chemin relatif en chemin absolu, en refusant toute sortie de MEDIA_ROOT. */
export function resolveMedia(relativePath) {
  const absolute = path.resolve(MEDIA_ROOT, relativePath || "");
  const root = path.resolve(MEDIA_ROOT);
  if (absolute !== root && !absolute.startsWith(root + path.sep)) {
    throw new Error("Chemin de media invalide.");
  }
  return absolute;
}

export function mediaStats(relativePath) {
  const absolute = resolveMedia(relativePath);
  return { absolute, stat: fs.statSync(absolute) };
}

/** Supprime un dossier de medias derives (segments HLS d'un clip). */
export async function removeMediaTree(relativePath) {
  try {
    await fsp.rm(resolveMedia(relativePath), { recursive: true, force: true });
  } catch {
    /* deja disparu */
  }
}

export async function removeMedia(relativePath) {
  try {
    await fsp.unlink(resolveMedia(relativePath));
  } catch {
    /* le fichier a deja disparu : rien a faire */
  }
}
