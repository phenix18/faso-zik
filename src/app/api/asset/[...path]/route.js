import { mediaStats } from "@/lib/storage";
import { rangeResponse } from "@/lib/http";

export const runtime = "nodejs";

const MIME = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".avif": "image/avif",
};

/** Sert les pochettes et photos d'artistes (images uniquement). */
export async function GET(request, { params }) {
  const relative = params.path.join("/");
  if (!relative.startsWith("image/")) {
    return new Response("Ressource non disponible.", { status: 404 });
  }

  const extension = relative.slice(relative.lastIndexOf(".")).toLowerCase();
  if (!MIME[extension]) return new Response("Format non servi.", { status: 404 });

  try {
    const { absolute, stat } = mediaStats(relative);
    return rangeResponse(absolute, stat, MIME[extension], request.headers.get("range"), {
      cacheControl: "public, max-age=31536000, immutable",
    });
  } catch {
    return new Response("Image introuvable.", { status: 404 });
  }
}
