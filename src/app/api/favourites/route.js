import { currentUser } from "@/lib/auth";
import { listFavourites, toggleFavourite } from "@/lib/repo/library";
import { fail, json } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await currentUser();
  if (!user) return fail("Connexion requise.", 401);
  return json({ tracks: await listFavourites(user.id) });
}

export async function POST(request) {
  const user = await currentUser();
  if (!user) return fail("Connexion requise.", 401);

  const { trackId } = await request.json();
  if (!trackId) return fail("Identifiant de morceau manquant.", 422);

  return json({ favourite: await toggleFavourite(user.id, trackId) });
}
