import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";
import { clientKey, rateLimit, tooManyRequests } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const handler = NextAuth(authOptions);

export { handler as GET };

/**
 * Les essais de mot de passe passent par ici.
 *
 * Le controle etait auparavant dans un middleware ; celui-ci ne tourne qu'en
 * runtime Edge, ou le pilote de base n'existe pas. L'enveloppe autour du
 * gestionnaire NextAuth fait le meme travail, du bon cote.
 */
export async function POST(request, contexte) {
  const limite = await rateLimit(clientKey(request, "auth"), {
    limit: 12,
    windowMs: 5 * 60 * 1000,
  });

  if (!limite.allowed) {
    return tooManyRequests(
      limite.retryAfter,
      `Trop de tentatives de connexion. Reessayez dans ${limite.retryAfter} secondes.`,
    );
  }

  return handler(request, contexte);
}
