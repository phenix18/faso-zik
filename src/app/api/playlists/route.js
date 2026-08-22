import { currentUser } from "@/lib/auth";
import { createPlaylist, listPlaylists } from "@/lib/repo/library";
import { fail, json } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await currentUser();
  if (!user) return fail("Connexion requise.", 401);
  return json({ playlists: await listPlaylists(user.id) });
}

export async function POST(request) {
  const user = await currentUser();
  if (!user) return fail("Connexion requise.", 401);

  const { name, isPublic } = await request.json();
  if (!name?.trim()) return fail("Donnez un nom a la playlist.", 422);

  return json({ playlist: await createPlaylist(user.id, name.trim(), !!isPublic) }, 201);
}
