import { z } from "zod";
import { currentUser } from "@/lib/auth";
import { getArtistByUserId } from "@/lib/repo/artists";
import { adresseDeDepot, stockageConfigure } from "@/lib/storage";
import { clientKey, rateLimit, tooManyRequests } from "@/lib/rateLimit";
import { fail, json } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  fichiers: z
    .array(
      z.object({
        role: z.enum(["media", "ecoute", "pochette"]),
        kind: z.enum(["audio", "video", "image"]),
        mime: z.string().max(100),
        taille: z.number().int().positive(),
        nom: z.string().max(200).optional(),
      }),
    )
    .min(1)
    .max(3),
});

/**
 * Adresses d'envoi direct.
 *
 * Le navigateur envoie les fichiers au stockage lui-meme : c'est ce qui
 * permet de deposer un clip de plusieurs centaines de megaoctets, qu'aucune
 * fonction n'accepterait dans un corps de requete. L'application ne fait que
 * verifier qui demande, et quoi.
 */
export async function POST(request) {
  const limite = await rateLimit(clientKey(request, "depot"), {
    limit: 60,
    windowMs: 60 * 60 * 1000,
  });
  if (!limite.allowed) {
    return tooManyRequests(limite.retryAfter, "Trop de depots consecutifs. Patientez un moment.");
  }

  if (!stockageConfigure()) {
    return fail("Le stockage des medias n'est pas configure sur ce site.", 503);
  }

  const user = await currentUser();
  if (!user) return fail("Connectez-vous pour publier un titre.", 401);

  const artiste = await getArtistByUserId(user.id);
  if (!artiste) {
    return fail("Ce compte n'est pas un compte artiste. Ouvrez votre espace artiste d'abord.", 403);
  }

  let corps;
  try {
    corps = schema.parse(await request.json());
  } catch (erreur) {
    return fail(erreur.errors?.[0]?.message || "Demande invalide.", 422);
  }

  const adresses = {};
  try {
    for (const fichier of corps.fichiers) {
      adresses[fichier.role] = await adresseDeDepot({
        kind: fichier.kind,
        mime: fichier.mime,
        taille: fichier.taille,
        nom: fichier.nom || "",
      });
    }
  } catch (erreur) {
    return fail(erreur.message, 422);
  }

  return json({ adresses }, 201);
}
