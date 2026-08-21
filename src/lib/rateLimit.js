/**
 * Limitation de debit par fenetre glissante, en memoire.
 *
 * Elle protege les points d'entree ou une boucle automatisee fait mal :
 * creation de comptes en masse, essais de mots de passe, saturation du disque
 * par depots repetes. La memoire suffit pour une instance unique, qui est le
 * mode de deploiement vise (un conteneur, un volume). Derriere plusieurs
 * instances il faut un compteur partage : remplacer `hits` par Redis suffit,
 * le reste du module ne bouge pas.
 */

const hits = new Map();

/** Purge periodique : sans elle la Map grossit avec chaque nouvelle adresse. */
function sweep(now) {
  for (const [key, entry] of hits) {
    if (entry.reset <= now) hits.delete(key);
  }
}

let lastSweep = 0;

/**
 * @returns {{ allowed: boolean, remaining: number, retryAfter: number }}
 */
export function rateLimit(key, { limit, windowMs }) {
  const now = Date.now();

  if (now - lastSweep > 60_000) {
    sweep(now);
    lastSweep = now;
  }

  const entry = hits.get(key);
  if (!entry || entry.reset <= now) {
    hits.set(key, { count: 1, reset: now + windowMs });
    return { allowed: true, remaining: limit - 1, retryAfter: 0 };
  }

  entry.count += 1;
  if (entry.count > limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfter: Math.ceil((entry.reset - now) / 1000),
    };
  }
  return { allowed: true, remaining: limit - entry.count, retryAfter: 0 };
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
