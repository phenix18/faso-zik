import { currentUser } from "@/lib/auth";
import { getTrackRow, recordEvent } from "@/lib/repo/tracks";
import { canStream } from "@/lib/permissions";
import { mediaStats } from "@/lib/storage";
import { fail, isFirstRequest, rangeResponse } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Lecture en ligne : jamais l'URL du fichier, toujours ce controle d'acces. */
export async function GET(request, { params }) {
  const row = getTrackRow(params.id);
  if (!row) return fail("Morceau introuvable.", 404);
  if (!canStream(row)) return fail("L'artiste n'autorise pas l'ecoute de ce titre.", 403);

  let media;
  try {
    media = mediaStats(row.media_path);
  } catch {
    return fail("Fichier media absent du stockage.", 410);
  }

  const range = request.headers.get("range");
  if (isFirstRequest(range)) {
    const user = await currentUser();
    recordEvent(row.id, "play", user?.id || null);
  }

  return rangeResponse(media.absolute, media.stat, row.media_mime, range, {
    filename: `${row.title}`,
    disposition: "inline",
  });
}

export async function HEAD(_request, { params }) {
  const row = getTrackRow(params.id);
  if (!row || !canStream(row)) return new Response(null, { status: 404 });
  try {
    const { stat } = mediaStats(row.media_path);
    return new Response(null, {
      status: 200,
      headers: {
        "Content-Type": row.media_mime,
        "Content-Length": String(stat.size),
        "Accept-Ranges": "bytes",
      },
    });
  } catch {
    return new Response(null, { status: 410 });
  }
}
