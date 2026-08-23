/**
 * NextAuth lit NEXTAUTH_URL au chargement de son module, donc pendant le
 * prerendu des pages statiques. Quand la variable manque, il se rabat sur
 * VERCEL_URL — que Vercel laisse *vide* pendant la construction. L'operateur
 * `??` ne rattrape pas la chaine vide, seulement null et undefined : on tombe
 * sur `new URL("")` et toute la construction echoue, sur des pages qui n'ont
 * rien a voir avec l'authentification.
 *
 * On garantit donc une valeur avant que Next ne lance ses processus de
 * prerendu. Celle de l'environnement prime toujours : c'est un filet, pas un
 * reglage — un site en production doit renseigner NEXTAUTH_URL lui-meme, sans
 * quoi les redirections de connexion pointeraient vers l'adresse de
 * deploiement plutot que vers le domaine du site.
 */
if (!process.env.NEXTAUTH_URL) {
  process.env.NEXTAUTH_URL = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "http://localhost:3000";
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // Pilotes de base : ils ne doivent pas etre embarques dans le bundle.
    // PGlite embarque un binaire WebAssembly, que le traceur ne sait pas
    // suivre ; postgres ouvre des connexions reseau natives.
    serverComponentsExternalPackages: ["postgres", "@electric-sql/pglite"],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), geolocation=(), interest-cohort=()",
          },
        ],
      },
      {
        // Le lecteur integrable est fait pour vivre dans le site des autres :
        // l'interdiction d'affichage en cadre vaut donc pour tout le reste.
        source: "/((?!embed).*)",
        headers: [{ key: "X-Frame-Options", value: "SAMEORIGIN" }],
      },
      {
        source: "/embed/:path*",
        headers: [{ key: "Content-Security-Policy", value: "frame-ancestors *" }],
      },
    ];
  },
};

module.exports = nextConfig;
