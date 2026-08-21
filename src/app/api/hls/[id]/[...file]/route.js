import path from "node:path";
import { getTrackRow } from "@/lib/repo/tracks";
import { canStream } from "@/lib/permissions";
import { mediaStats } from "@/lib/storage";
import { rangeResponse } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TYPES = {
  ".m3u8": "application/vnd.apple.mpegurl",
  ".ts": "video/mp2t",
};

/**
 * Sert la playlist et les segments d'un clip decoupe.
 *
 * Le chemin demande est reconstruit a partir du dossier enregistre pour ce
 * morceau : le navigateur ne choisit que le nom du segment, jamais l'endroit
 * ou aller le chercher.
 */
export async function GET(request, { params }) {
  const row = getTrackRow(params.id);
  if (!row || !row.hls_path) return new Response("Introuvable.", { status: 404 });
  if (!canStream(row)) {
    return new Response("L'artiste n'autorise pas la lecture de ce clip.", { status: 403 });
  }

  const demande = params.file.join("/");
  const extension = path.extname(demande).toLowerCase();
  if (!TYPES[extension] || demande.includes("..")) {
    return new Response("Ressource non servie.", { status: 404 });
  }

  try {
    const { absolute, stat } = mediaStats(path.join(row.hls_path, demande));
    return rangeResponse(absolute, stat, TYPES[extension], request.headers.get("range"), {
      // Les segments ne changent jamais ; la playlist non plus, une fois le
      // decoupage termine.
      cacheControl: "private, max-age=3600",
    });
  } catch {
    return new Response("Segment introuvable.", { status: 404 });
  }
}
