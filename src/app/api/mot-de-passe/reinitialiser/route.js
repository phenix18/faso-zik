import { z } from "zod";
import { appliquerReinitialisation, comptePourJeton } from "@/lib/repo/passwords";
import { clientKey, rateLimit, tooManyRequests } from "@/lib/rateLimit";
import { fail, json } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  jeton: z.string().min(20),
  motDePasse: z.string().min(8, "Le mot de passe doit contenir au moins 8 caracteres."),
});

/** Verifie qu'un lien est encore valable, avant d'afficher le formulaire. */
export async function GET(request) {
  const jeton = new URL(request.url).searchParams.get("jeton") || "";
  return json({ valide: !!await comptePourJeton(jeton) });
}

export async function POST(request) {
  const limite = await rateLimit(clientKey(request, "reinit"), { limit: 10, windowMs: 15 * 60 * 1000 });
  if (!limite.allowed) {
    return tooManyRequests(limite.retryAfter, "Trop de tentatives. Reessayez plus tard.");
  }

  let corps;
  try {
    corps = schema.parse(await request.json());
  } catch (erreur) {
    return fail(erreur.errors?.[0]?.message || "Donnees invalides.", 422);
  }

  if (!await appliquerReinitialisation(corps.jeton, corps.motDePasse)) {
    return fail("Ce lien a expire ou a deja servi. Demandez-en un nouveau.", 410);
  }

  return json({ ok: true });
}
