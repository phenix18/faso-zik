import { NextResponse } from "next/server";
import { clientKey, rateLimit } from "@/lib/rateLimit";

/**
 * La connexion est servie par NextAuth : on ne peut pas y ajouter de controle
 * dans le corps de la route. Le middleware est donc le seul endroit ou freiner
 * les essais de mots de passe.
 */
export function middleware(request) {
  const { allowed, retryAfter } = rateLimit(clientKey(request, "auth"), {
    limit: 12,
    windowMs: 5 * 60 * 1000,
  });

  if (!allowed) {
    return NextResponse.json(
      { error: `Trop de tentatives de connexion. Reessayez dans ${retryAfter} secondes.` },
      { status: 429, headers: { "Retry-After": String(retryAfter) } },
    );
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/api/auth/callback/:path*", "/api/auth/signin/:path*"],
};
