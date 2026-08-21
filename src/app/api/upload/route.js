import path from "node:path";
import { currentUser } from "@/lib/auth";
import { getArtistByUserId } from "@/lib/repo/artists";
import { createTrack } from "@/lib/repo/tracks";
import { MEDIA_ROOT, removeMedia, saveUpload } from "@/lib/storage";
import { planifierTranscodage } from "@/lib/transcodeQueue";
import { fail, json } from "@/lib/http";
import { clientKey, rateLimit, tooManyRequests } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Lit la duree (et le BPM s'il est balise) depuis les tags du fichier. */
async function readMetadata(relativePath) {
  try {
    const { parseFile } = await import("music-metadata");
    const meta = await parseFile(path.join(MEDIA_ROOT, relativePath), { duration: true });
    return {
      duration: Math.round(meta.format?.duration || 0),
      bpm: meta.common?.bpm ? Number(meta.common.bpm) : null,
    };
  } catch {
    // Un conteneur illisible par les tags reste diffusable : on n'echoue pas.
    return { duration: 0, bpm: null };
  }
}

export async function POST(request) {
  const limit = rateLimit(clientKey(request, "upload"), {
    limit: 20,
    windowMs: 60 * 60 * 1000,
  });
  if (!limit.allowed) {
    return tooManyRequests(
      limit.retryAfter,
      "Trop de depots consecutifs. Laissez passer un moment avant de reprendre.",
    );
  }

  const user = await currentUser();
  if (!user) return fail("Connectez-vous pour publier un titre.", 401);

  const artist = getArtistByUserId(user.id);
  if (!artist) {
    return fail("Ce compte n'est pas un compte artiste. Ouvrez votre espace artiste d'abord.", 403);
  }

  const form = await request.formData();
  const media = form.get("media");
  const cover = form.get("cover");
  const title = String(form.get("title") || "").trim();

  if (!title) return fail("Le titre est obligatoire.", 422);
  if (!media || typeof media === "string") return fail("Aucun fichier audio ou video recu.", 422);

  // Sans declaration de droits, rien n'entre au catalogue : c'est la seule
  // trace que le deposant assume la paternite de ce qu'il publie.
  if (form.get("rightsConfirmed") !== "true") {
    return fail(
      "Vous devez declarer detenir les droits sur cet enregistrement avant de le publier.",
      422,
    );
  }

  const kind = media.type?.startsWith("video/") ? "video" : "audio";

  let saved;
  let coverUrl = null;
  try {
    saved = await saveUpload(media, kind);
    if (cover && typeof cover !== "string" && cover.size > 0) {
      const savedCover = await saveUpload(cover, "image");
      coverUrl = `/api/asset/${savedCover.relativePath.split(path.sep).join("/")}`;
    }
  } catch (error) {
    if (saved) await removeMedia(saved.relativePath);
    return fail(error.message, 422);
  }

  const meta = await readMetadata(saved.relativePath);
  const bool = (name) => form.get(name) === "true" || form.get(name) === "on";

  const track = createTrack({
    artistId: artist.id,
    title,
    kind,
    genre: form.get("genre") || null,
    language: form.get("language") || null,
    description: form.get("description") || null,
    duration: meta.duration,
    bpm: form.get("bpm") ? Number(form.get("bpm")) : meta.bpm,
    musicKey: form.get("musicKey") || null,
    coverUrl,
    mediaPath: saved.relativePath,
    mediaMime: saved.mime,
    mediaSize: saved.size,
    allowDownload: bool("allowDownload"),
    allowDj: bool("allowDj"),
    license: form.get("license") || undefined,
    rightsConfirmed: true,
    published: form.get("published") !== "false",
  });

  // Le depot repond tout de suite ; la version allegee se fabrique derriere.
  // Le titre reste ecoutable dans sa version d'origine en attendant.
  planifierTranscodage(track.id);

  return json({ track }, 201);
}
