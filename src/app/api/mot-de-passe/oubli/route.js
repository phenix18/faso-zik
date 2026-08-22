import { z } from "zod";
import { findUserByEmail } from "@/lib/repo/users";
import { creerJetonReinitialisation, purgerJetonsExpires } from "@/lib/repo/passwords";
import { courrielConfigure, envoyerLienReinitialisation } from "@/lib/courriel";
import { clientKey, rateLimit, tooManyRequests } from "@/lib/rateLimit";
import { fail, json } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({ email: z.string().email() });

/**
 * Demande de reinitialisation.
 *
 * La reponse est la meme que le compte existe ou non : repondre
 * differemment reviendrait a offrir un moyen de savoir qui est inscrit.
 */
export async function POST(request) {
  const limite = await rateLimit(clientKey(request, "oubli"), { limit: 5, windowMs: 60 * 60 * 1000 });
  if (!limite.allowed) {
    return tooManyRequests(limite.retryAfter, "Trop de demandes. Reessayez plus tard.");
  }

  if (!courrielConfigure()) {
    return fail(
      "La reinitialisation par courriel n'est pas configuree sur ce site. Contactez l'equipe.",
      503,
    );
  }

  let corps;
  try {
    corps = schema.parse(await request.json());
  } catch {
    return fail("Adresse e-mail invalide.", 422);
  }

  await purgerJetonsExpires();
  const compte = await findUserByEmail(corps.email);

  if (compte) {
    const { jeton, dureeMinutes } = await creerJetonReinitialisation(compte.id);
    const base = process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin;

    try {
      await envoyerLienReinitialisation({
        destinataire: compte.email,
        nom: compte.name,
        lien: `${base}/mot-de-passe/${jeton}`,
        dureeMinutes,
      });
    } catch (erreur) {
      // L'echec d'envoi est un incident du site, pas une information a cacher.
      console.error("Envoi du lien de reinitialisation :", erreur.message);
      return fail("Le courriel n'a pas pu partir. Reessayez dans un moment.", 502);
    }
  }

  return json({
    message: "Si un compte existe avec cette adresse, un lien vient de lui etre envoye.",
  });
}
