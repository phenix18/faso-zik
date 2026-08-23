import { currentUser } from "@/lib/auth";
import {
  addToPlaylist,
  deletePlaylist,
  getPlaylist,
  removeFromPlaylist,
} from "@/lib/repo/library";
import { fail, json } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function ownedPlaylist(id) {
  const user = await currentUser();
  const playlist = await getPlaylist(id);
  if (!playlist) return { error: fail("Playlist introuvable.", 404) };
  if (!user || playlist.user_id !== user.id) {
    return { error: fail("Cette playlist ne vous appartient pas.", 403) };
  }
  return { playlist };
}

export async function GET(_request, { params }) {
  const playlist = await getPlaylist(params.id);
  if (!playlist) return fail("Playlist introuvable.", 404);

  if (!playlist.isPublic) {
    const user = await currentUser();
    if (!user || playlist.user_id !== user.id) return fail("Playlist privee.", 403);
  }
  return json({ playlist });
}

export async function POST(request, { params }) {
  const { error } = await ownedPlaylist(params.id);
  if (error) return error;

  const { trackId, action } = await request.json();
  if (!trackId) return fail("Identifiant de morceau manquant.", 422);

  return json({
    playlist:
      action === "remove"
        ? await removeFromPlaylist(params.id, trackId)
        : await addToPlaylist(params.id, trackId),
  });
}

export async function DELETE(_request, { params }) {
  const { error } = await ownedPlaylist(params.id);
  if (error) return error;

  await deletePlaylist(params.id);
  return json({ ok: true });
}
