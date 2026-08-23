import { query } from "@/lib/db";
import { SITE_URL } from "@/lib/siteConfig";

export const dynamic = "force-dynamic";

/**
 * Plan du site.
 *
 * Genere a la demande plutot que fige a la construction : le catalogue change
 * chaque fois qu'un artiste publie, et un plan obsolete ne sert a rien.
 */
export default async function sitemap() {

  const pages = [
    ["", 1, "daily"],
    ["/titres", 0.9, "daily"],
    ["/clips", 0.8, "daily"],
    ["/artistes", 0.8, "weekly"],
    ["/classement", 0.7, "daily"],
    ["/dj", 0.6, "monthly"],
    ["/droits", 0.3, "yearly"],
  ].map(([chemin, priority, changeFrequency]) => ({
    url: `${SITE_URL}${chemin}`,
    lastModified: new Date(),
    changeFrequency,
    priority,
  }));

  const lignesArtistes = await query(
    "SELECT slug, created_at FROM artists ORDER BY created_at DESC LIMIT 5000",
  );
  const artistes = lignesArtistes.map((artiste) => ({
      url: `${SITE_URL}/artistes/${artiste.slug}`,
      lastModified: new Date(artiste.created_at),
      changeFrequency: "weekly",
      priority: 0.7,
  }));

  const lignesTitres = await query(
    "SELECT id, created_at FROM tracks WHERE published ORDER BY created_at DESC LIMIT 20000",
  );
  const titres = lignesTitres.map((titre) => ({
      url: `${SITE_URL}/titre/${titre.id}`,
      lastModified: new Date(titre.created_at),
      changeFrequency: "monthly",
      priority: 0.6,
  }));

  return [...pages, ...artistes, ...titres];
}
