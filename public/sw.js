/**
 * Service worker de FASO-ZIK.
 *
 * Il met en cache la coquille de l'interface pour que le site s'ouvre vite, et
 * meme sans reseau, sur une connexion mobile capricieuse.
 *
 * Ce qu'il ne touche jamais : les medias. Le streaming repose sur des
 * requetes partielles (Range) qu'un cache intermediaire gere mal, et mettre
 * des clips en cache remplirait le telephone de l'auditeur a son insu. Les
 * fichiers passent donc directement au reseau.
 */

const VERSION = "faso-zik-v1";
const COQUILLE = `${VERSION}-coquille`;
const STATIQUES = `${VERSION}-statiques`;
const PAGE_HORS_LIGNE = "/hors-ligne";

const CHEMINS_IGNORES = [
  "/api/stream/",
  "/api/hls/",
  "/api/download/",
  "/api/asset/",
  "/api/auth/",
  "/api/upload",
];

self.addEventListener("install", (evenement) => {
  evenement.waitUntil(
    caches.open(COQUILLE).then((cache) => cache.addAll([PAGE_HORS_LIGNE, "/icone-192.png"])),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (evenement) => {
  evenement.waitUntil(
    caches
      .keys()
      .then((noms) =>
        Promise.all(noms.filter((nom) => !nom.startsWith(VERSION)).map((nom) => caches.delete(nom))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (evenement) => {
  const requete = evenement.request;
  if (requete.method !== "GET") return;

  const url = new URL(requete.url);
  if (url.origin !== self.location.origin) return;
  if (CHEMINS_IGNORES.some((chemin) => url.pathname.startsWith(chemin))) return;
  // Une requete partielle ne doit jamais passer par le cache : la reponse
  // stockee serait un fragment servi comme s'il etait complet.
  if (requete.headers.has("range")) return;

  // Fichiers de build : leur nom contient une empreinte, ils ne changent
  // jamais sous la meme adresse.
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icone-")) {
    evenement.respondWith(
      caches.open(STATIQUES).then(async (cache) => {
        const enCache = await cache.match(requete);
        if (enCache) return enCache;
        const reponse = await fetch(requete);
        if (reponse.ok) cache.put(requete, reponse.clone());
        return reponse;
      }),
    );
    return;
  }

  // Navigation : le reseau d'abord, le cache en secours, la page hors ligne en
  // dernier recours.
  if (requete.mode === "navigate") {
    evenement.respondWith(
      fetch(requete)
        .then((reponse) => {
          const copie = reponse.clone();
          caches.open(COQUILLE).then((cache) => cache.put(requete, copie));
          return reponse;
        })
        .catch(async () => (await caches.match(requete)) || caches.match(PAGE_HORS_LIGNE)),
    );
  }
});
