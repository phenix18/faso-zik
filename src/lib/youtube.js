/**
 * Reconnaissance d'une adresse YouTube.
 *
 * Le DJ colle ce qu'il a sous la main : lien de partage, adresse longue,
 * short, parfois l'identifiant seul. Le point qui compte n'est pas la
 * commodite mais la fermeture : le resultat sert a construire l'adresse d'un
 * cadre, et une adresse d'un autre domaine ne doit jamais passer. On extrait
 * donc un identifiant, jamais une adresse fournie telle quelle.
 */

const IDENTIFIANT = /^[A-Za-z0-9_-]{11}$/;
const HOTES = ["youtube.com", "m.youtube.com", "music.youtube.com"];

export function identifiantYouTube(adresse) {
  const texte = String(adresse || "").trim();
  if (!texte) return null;
  if (IDENTIFIANT.test(texte)) return texte;

  let url;
  try {
    url = new URL(texte);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;

  const hote = url.hostname.replace(/^www\./, "");

  if (hote === "youtu.be") {
    const court = url.pathname.slice(1);
    return IDENTIFIANT.test(court) ? court : null;
  }

  if (!HOTES.includes(hote)) return null;

  const parametre = url.searchParams.get("v");
  if (parametre && IDENTIFIANT.test(parametre)) return parametre;

  const chemin = url.pathname.match(/^\/(?:embed|shorts|live)\/([A-Za-z0-9_-]{11})/);
  return chemin ? chemin[1] : null;
}
