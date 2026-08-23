import { z } from "zod";
import { currentUser } from "@/lib/auth";
import { getTrackRow } from "@/lib/repo/tracks";
import { ajouterCommentaire, commentairesDuTitre } from "@/lib/repo/comments";
import { canStream } from "@/lib/permissions";
import { clientKey, rateLimit, tooManyRequests } from "@/lib/rateLimit";
import { fail, json } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Lecture ouverte : un auditeur de passage doit voir ce qui se dit. */
export async function GET(request) {
  const trackId = new URL(request.url).searchParams.get("titre") || "";
  if (!trackId) return fail("Titre manquant.", 422);

  const row = await getTrackRow(trackId);
  if (!row || !row.published) return fail("Morceau introuvable.", 404);

  return json({ commentaires: await commentairesDuTitre(trackId) });
}

const schema = z.object({
  trackId: z.string().min(1),
  corps: z.string().min(2, "Le commentaire est trop court.").max(2000),
});

/**
 * Ecriture reservee aux comptes.
 *
 * Sans identite, aucune moderation n'est possible : un retrait ne vaut que si
 * l'on sait a qui il s'applique. Le debit est borne par la meme occasion —
 * un compte tout neuf ne peut pas deverser cent messages en une minute.
 */
export async function POST(request) {
  const user = await currentUser();
  if (!user) return fail("Connectez-vous pour laisser un commentaire.", 401);

  const limite = await rateLimit(clientKey(request, `commentaire:${user.id}`), {
    limit: 10,
    windowMs: 10 * 60 * 1000,
  });
  if (!limite.allowed) {
    return tooManyRequests(limite.retryAfter, "Trop de commentaires d'affilee. Patientez un peu.");
  }

  let corps;
  try {
    corps = schema.parse(await request.json());
  } catch (erreur) {
    return fail(erreur.errors?.[0]?.message || "Commentaire invalide.", 422);
  }

  const row = await getTrackRow(corps.trackId);
  if (!row || !row.published) return fail("Morceau introuvable.", 404);
  // Un titre dont l'ecoute est fermee n'a pas de page publique a commenter.
  if (!canStream(row)) return fail("Ce titre n'est pas ouvert au public.", 403);

  try {
    return json({ commentaire: await ajouterCommentaire({ ...corps, userId: user.id }) }, 201);
  } catch (erreur) {
    return fail(erreur.message, 422);
  }
}
