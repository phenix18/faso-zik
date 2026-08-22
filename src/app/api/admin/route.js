import { currentUser } from "@/lib/auth";
import { basculerVerification, retirerTitre } from "@/lib/repo/admin";
import { fail, json } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Toutes les actions d'administration passent par ce controle unique. */
async function exigerAdmin() {
  const user = await currentUser();
  if (!user) return { erreur: fail("Connexion requise.", 401) };
  if (user.role !== "admin") return { erreur: fail("Reserve a l'administration.", 403) };
  return { user };
}

export async function POST(request) {
  const { erreur } = await exigerAdmin();
  if (erreur) return erreur;

  const { action, artistId, trackId } = await request.json();

  if (action === "verifier") {
    if (!artistId) return fail("Identifiant d'artiste manquant.", 422);
    const etat = await basculerVerification(artistId);
    if (etat === null) return fail("Artiste introuvable.", 404);
    return json({ verifie: etat });
  }

  if (action === "retirer") {
    if (!trackId) return fail("Identifiant de titre manquant.", 422);
    await retirerTitre(trackId);
    return json({ retire: true });
  }

  return fail("Action inconnue.", 422);
}
