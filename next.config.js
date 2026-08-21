/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Sortie autonome : l'image de production n'embarque que les dependances
  // reellement tracees, au lieu de tout node_modules.
  output: "standalone",
  experimental: {
    serverComponentsExternalPackages: ["better-sqlite3", "music-metadata"],
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
