import { z } from "zod";
import { currentUser } from "@/lib/auth";
import { albumParId, modifierAlbum, rattacherTitre, supprimerAlbum } from "@/lib/repo/albums";
import { getTrackRow } from "@/lib/repo/tracks";
import { ownsTrack } from "@/lib/permissions";
import { fail, json } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Un album n'appartient qu'a son artiste — ou a l'administration. */
async function albumPossede(id) {
  const user = await currentUser();
  const album = await albumParId(id);
  if (!album) return { erreur: fail("Album introuvable.", 404) };

  const autorise = user && (user.role === "admin" || user.artistId === album.artist_id);
  if (!autorise) return { erreur: fail("Cet album ne vous appartient pas.", 403) };

  return { album, user };
}

const patchSchema = z.object({
  titre: z.string().min(1).max(160).optional(),
  kind: z.string().max(20).optional(),
  description: z.string().max(2000).optional(),
  releasedOn: z.string().max(10).optional(),
  published: z.boolean().optional(),
});

export async function PATCH(request, { params }) {
  const { erreur } = await albumPossede(params.id);
  if (erreur) return erreur;

  let champs;
  try {
    champs = patchSchema.parse(await request.json());
  } catch (probleme) {
    return fail(probleme.errors?.[0]?.message || "Donnees invalides.", 422);
  }

  return json({ album: await modifierAlbum(params.id, champs) });
}

/** Rattache ou detache un titre. Les deux doivent appartenir a l'appelant. */
export async function POST(request, { params }) {
  const { erreur, user } = await albumPossede(params.id);
  if (erreur) return erreur;

  const { trackId, trackNo, detacher } = await request.json();
  const morceau = await getTrackRow(trackId || "");
  if (!morceau) return fail("Morceau introuvable.", 404);
  if (!ownsTrack(user, morceau)) return fail("Ce morceau ne vous appartient pas.", 403);

  await rattacherTitre(morceau.id, detacher ? null : params.id, detacher ? null : trackNo ?? null);
  return json({ ok: true });
}

export async function DELETE(_request, { params }) {
  const { erreur } = await albumPossede(params.id);
  if (erreur) return erreur;

  await supprimerAlbum(params.id);
  return json({ ok: true });
}
