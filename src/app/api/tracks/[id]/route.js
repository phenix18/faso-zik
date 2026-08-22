import { z } from "zod";
import { currentUser } from "@/lib/auth";
import { deleteTrack, getTrack, getTrackRow, updateTrack } from "@/lib/repo/tracks";
import { ownsTrack } from "@/lib/permissions";
import { cheminDepuisAdresse, nettoyerObjets } from "@/lib/storage";
import { fail, json } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const patchSchema = z.object({
  title: z.string().min(1).max(160).optional(),
  genre: z.string().max(60).optional(),
  language: z.string().max(60).optional(),
  description: z.string().max(2000).optional(),
  bpm: z.number().min(30).max(300).nullable().optional(),
  musicKey: z.string().max(10).optional(),
  license: z.string().max(160).optional(),
  // Prix du telechargement en francs CFA ; plafonne pour eviter une faute de
  // frappe qui rendrait un titre inachetable.
  priceCfa: z.number().int().min(0).max(500000).optional(),
  allowStream: z.boolean().optional(),
  allowDownload: z.boolean().optional(),
  allowDj: z.boolean().optional(),
  published: z.boolean().optional(),
});

export async function GET(_request, { params }) {
  const track = await getTrack(params.id);
  if (!track || !track.published) return fail("Morceau introuvable.", 404);
  return json({ track });
}

export async function PATCH(request, { params }) {
  const user = await currentUser();
  const row = await getTrackRow(params.id);
  if (!row) return fail("Morceau introuvable.", 404);
  if (!ownsTrack(user, row)) return fail("Seul l'artiste proprietaire peut modifier ce morceau.", 403);

  let fields;
  try {
    fields = patchSchema.parse(await request.json());
  } catch (error) {
    return fail(error.errors?.[0]?.message || "Donnees invalides.", 422);
  }

  return json({ track: await updateTrack(params.id, fields) });
}

export async function DELETE(_request, { params }) {
  const user = await currentUser();
  const row = await getTrackRow(params.id);
  if (!row) return fail("Morceau introuvable.", 404);
  if (!ownsTrack(user, row)) return fail("Seul l'artiste proprietaire peut supprimer ce morceau.", 403);

  await deleteTrack(params.id);
  // Les fichiers derives ne sont references que par ce morceau : ils partent
  // avec lui, sinon le stockage se remplit d'objets orphelins.
  await nettoyerObjets([row.media_path, row.preview_path, cheminDepuisAdresse(row.cover_url)]);
  return json({ ok: true });
}
