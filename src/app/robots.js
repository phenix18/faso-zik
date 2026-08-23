import { SITE_URL } from "@/lib/siteConfig";

export default function robots() {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Ni les espaces personnels, ni les fichiers eux-memes : un moteur qui
        // aspire des clips consomme la bande passante des auditeurs.
        disallow: ["/api/", "/studio", "/admin", "/compte", "/paiement/", "/mot-de-passe/", "/embed/"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
