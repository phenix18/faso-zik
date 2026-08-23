import { unique } from "@/lib/db";

/**
 * Limitation de debit, comptee en base.
 *
 * Un compteur en memoire ne sert a rien des lors que plusieurs instances
 * repondent : chacune aurait le sien, et la limite serait multipliee par leur
 * nombre. Sur une plateforme sans serveur, ce nombre est inconnu et varie.
 *
 * Le compte et la remise a zero se font en une seule instruction : deux
 * requetes simultanees ne peuvent pas passer toutes les deux sous la limite.
 */

export async function rateLimit(cle, { limit, windowMs }) {
  const secondes = Math.max(1, Math.round(windowMs / 1000));

  const ligne = await unique(
    `INSERT INTO rate_limits (cle, compte, expire_a)
          VALUES ($1, 1, now() + ($2 || ' seconds')::interval)
     ON CONFLICT (cle) DO UPDATE
        SET compte   = CASE WHEN rate_limits.expire_a <= now() THEN 1
                            ELSE rate_limits.compte + 1 END,
            expire_a = CASE WHEN rate_limits.expire_a <= now()
                            THEN now() + ($2 || ' seconds')::interval
                            ELSE rate_limits.expire_a END
     RETURNING compte, GREATEST(0, CEIL(EXTRACT(EPOCH FROM (expire_a - now()))))::int AS reste`,
    [cle, String(secondes)],
  );

  const compte = ligne?.compte ?? 1;
  if (compte > limit) {
    return { allowed: false, remaining: 0, retryAfter: ligne?.reste || secondes };
  }
  return { allowed: true, remaining: Math.max(0, limit - compte), retryAfter: 0 };
}

/**
 * Adresse de l'appelant. Derriere un proxy inverse, seul le premier maillon de
 * x-forwarded-for est renseigne par notre propre proxy ; les suivants peuvent
 * etre falsifies par le client, d'ou le decoupage.
 */
export function clientKey(request, scope) {
  const forwarded = request.headers.get("x-forwarded-for");
  const address =
    forwarded?.split(",")[0].trim() || request.headers.get("x-real-ip") || "inconnu";
  return `${scope}:${address}`;
}

/** Reponse 429 uniforme, avec l'en-tete que les navigateurs et robots lisent. */
export function tooManyRequests(retryAfter, message) {
  return Response.json(
    { error: message || `Trop de tentatives. Reessayez dans ${retryAfter} secondes.` },
    { status: 429, headers: { "Retry-After": String(retryAfter) } },
  );
}

/** Purge des compteurs perimes : appelee de loin en loin, sans urgence. */
export async function purgerCompteurs() {
  const { execute } = await import("@/lib/db");
  return execute("DELETE FROM rate_limits WHERE expire_a <= now() - interval '1 hour'");
}
