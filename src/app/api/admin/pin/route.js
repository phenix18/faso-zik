import { cookies } from "next/headers";
import { currentUser } from "@/lib/auth";
import { COOKIE_PIN, pinConfigure, pinValide, signerJetonPin } from "@/lib/adminPin";
import { clientKey, rateLimit, tooManyRequests } from "@/lib/rateLimit";
import { fail, json } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Ouverture de la console par le code d'administration.
 *
 * Un code a six chiffres se devine en un million d'essais : sans limite de
 * debit, quelques minutes suffiraient. Cinq essais par quart d'heure ramenent
 * cette recherche a plusieurs annees.
 */
export async function POST(request) {
  const user = await currentUser();
  if (!user) return fail("Connexion requise.", 401);
  if (user.role !== "admin") return fail("Reserve a l'administration.", 403);

  const limite = await rateLimit(clientKey(request, `pin:${user.id}`), {
    limit: 5,
    windowMs: 15 * 60 * 1000,
  });
  if (!limite.allowed) {
    return tooManyRequests(limite.retryAfter, "Trop d'essais. Reessayez plus tard.");
  }

  if (!pinConfigure()) {
    return fail("Aucun code d'administration n'est configure sur ce site.", 503);
  }

  const { code } = await request.json().catch(() => ({}));
  // Le message ne dit pas ce qui cloche : un refus bavard aide qui cherche.
  if (!pinValide(code)) return fail("Code refuse.", 403);

  cookies().set(COOKIE_PIN, signerJetonPin(user.id), {
    httpOnly: true, // hors de portee du JavaScript de la page
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 8 * 60 * 60,
  });
  return json({ ok: true });
}

/** Fermeture de la console, sans se deconnecter du site. */
export async function DELETE() {
  cookies().delete(COOKIE_PIN);
  return json({ ok: true });
}
