import { currentUser } from "@/lib/auth";
import { getTrackRow, recordEvent } from "@/lib/repo/tracks";
import { canDownload, estPayant, peutTelecharger } from "@/lib/permissions";
import { aAchete } from "@/lib/repo/payments";
import { extensionFor, mediaStats } from "@/lib/storage";
import { fail, isFirstRequest, rangeResponse } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Telechargement : autorise uniquement si l'artiste a coche le droit sur ce
 * morceau. Le refus est renvoye par le serveur, pas seulement masque dans
 * l'interface.
 */
export async function GET(request, { params }) {
  const row = getTrackRow(params.id);
  if (!row) return fail("Morceau introuvable.", 404);
  if (!canDownload(row)) {
    return fail("L'artiste n'autorise pas le telechargement de ce titre.", 403);
  }

  // Le paiement se verifie ici, pas dans l'interface : le lien direct ne doit
  // pas suffire a contourner l'achat.
  const user = await currentUser();
  if (estPayant(row) && !peutTelecharger(row, { user, dejaPaye: aAchete(user?.id, row.id) })) {
    return fail(
      `Ce titre est vendu ${row.price_cfa} F CFA par l'artiste. Reglez-le pour le telecharger.`,
      402,
    );
  }

  let media;
  try {
    media = mediaStats(row.media_path);
  } catch {
    return fail("Fichier media absent du stockage.", 410);
  }

  const range = request.headers.get("range");
  if (isFirstRequest(range)) {
    recordEvent(row.id, "download", user?.id || null);
  }

  const filename = `${row.artist_name} - ${row.title}${extensionFor(row.media_mime)}`;
  return rangeResponse(media.absolute, media.stat, row.media_mime, range, {
    filename,
    disposition: "attachment",
  });
}
