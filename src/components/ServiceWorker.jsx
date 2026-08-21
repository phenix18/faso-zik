"use client";

import { useEffect } from "react";

/**
 * Enregistre le service worker.
 *
 * Uniquement en production : en developpement, un worker actif servirait des
 * pages mises en cache et masquerait les modifications en cours.
 */
export default function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker.register("/sw.js").catch((erreur) => {
      console.warn("Service worker non enregistre :", erreur.message);
    });
  }, []);

  return null;
}
