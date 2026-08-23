import { cookies } from "next/headers";
import { currentUser } from "@/lib/auth";
import { COOKIE_PIN, jetonPinValide, pinConfigure } from "@/lib/adminPin";
import { basculerVerification, republierTitre, retirerTitre } from "@/lib/repo/admin";
import { masquerCommentaire } from "@/lib/repo/comments";
import { fail, json } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Toutes les actions d'administration passent par ce controle unique.
 *
 * Trois conditions : etre connecte, porter le role, et avoir ouvert la console
 * avec le code. Le code n'est exige que s'il est configure — un site qui n'en
 * pose pas ne doit pas se retrouver ferme a lui-meme.
 */
async function exigerAdmin() {
  const user = await currentUser();
  if (!user) return { erreur: fail("Connexion requise.", 401) };
  if (user.role !== "admin") return { erreur: fail("Reserve a l'administration.", 403) };

  if (pinConfigure() && !jetonPinValide(cookies().get(COOKIE_PIN)?.value, user.id)) {
    return { erreur: fail("Console fermee : saisissez le code d'administration.", 403) };
  }
  return { user };
}

export async function POST(request) {
  const { erreur, user } = await exigerAdmin();
  if (erreur) return erreur;

  const { action, artistId, trackId, commentId } = await request.json();

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

  if (action === "republier") {
    if (!trackId) return fail("Identifiant de titre manquant.", 422);
    await republierTitre(trackId);
    return json({ republie: true });
  }

  if (action === "masquer-commentaire") {
    if (!commentId) return fail("Identifiant de commentaire manquant.", 422);
    await masquerCommentaire(commentId, user.id);
    return json({ masque: true });
  }

  return fail("Action inconnue.", 422);
}
