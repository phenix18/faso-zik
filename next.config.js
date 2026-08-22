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
