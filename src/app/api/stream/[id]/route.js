import { currentUser } from "@/lib/auth";
import { getTrackRow, playbackSource, recordEvent } from "@/lib/repo/tracks";
import { canStream } from "@/lib/permissions";
import { adresseDeLecture } from "@/lib/storage";
import { fail } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Lecture en ligne.
 *
 * L'application verifie l'autorisation puis redirige vers une adresse signee
 * de courte duree : c'est le stockage qui sert les octets, et lui qui gere les
 * requetes partielles dont depend le deplacement dans un morceau. Faire
 * transiter un fichier par une fonction serait lent, couteux, et borne par sa
 * duree d'execution.
 */
export async function GET(request, { params }) {
  const row = await getTrackRow(params.id);
  if (!row) return fail("Morceau introuvable.", 404);
  if (!canStream(row)) return fail("L'artiste n'autorise pas l'ecoute de ce titre.", 403);

  // Version allegee si elle existe, original sinon.
  const source = playbackSource(row);

  let adresse;
  try {
    adresse = await adresseDeLecture(source.path);
  } catch {
    return fail("Fichier media absent du stockage.", 410);
  }

  // Une requete partielle est une reprise de lecture, pas une nouvelle ecoute.
  if (!request.headers.get("range")) {
    const user = await currentUser();
    await recordEvent(row.id, "play", user?.id || null);
  }

  return Response.redirect(adresse, 307);
}
