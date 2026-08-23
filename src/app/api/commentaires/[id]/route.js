import { currentUser } from "@/lib/auth";
import { commentaireParId, masquerCommentaire } from "@/lib/repo/comments";
import { getTrackRow } from "@/lib/repo/tracks";
import { ownsTrack } from "@/lib/permissions";
import { fail, json } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Retrait d'un commentaire.
 *
 * Trois personnes le peuvent : son auteur, l'artiste du morceau, et
 * l'administration. L'artiste parce que c'est sa page ; l'administration parce
 * qu'elle repond des contenus du site. Le commentaire est masque, pas efface.
 */
export async function DELETE(_request, { params }) {
  const user = await currentUser();
  if (!user) return fail("Connexion requise.", 401);

  const commentaire = await commentaireParId(params.id);
  if (!commentaire || commentaire.masque) return fail("Commentaire introuvable.", 404);

  const estAuteur = commentaire.auteur.id === user.id;
  const row = await getTrackRow(commentaire.trackId);
  if (!estAuteur && !ownsTrack(user, row)) {
    return fail("Seuls l'auteur, l'artiste ou l'administration peuvent retirer ce commentaire.", 403);
  }

  await masquerCommentaire(params.id, user.id);
  return json({ ok: true });
}
