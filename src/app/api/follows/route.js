import { currentUser } from "@/lib/auth";
import { artistesSuivis, basculerAbonnement } from "@/lib/repo/social";
import { fail, json } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await currentUser();
  if (!user) return fail("Connexion requise.", 401);
  return json({ artistes: artistesSuivis(user.id) });
}

export async function POST(request) {
  const user = await currentUser();
  if (!user) return fail("Connexion requise.", 401);

  const { artistId } = await request.json();
  if (!artistId) return fail("Identifiant d'artiste manquant.", 422);

  return json({ suit: basculerAbonnement(user.id, artistId) });
}
