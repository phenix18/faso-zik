"use client";

import { useEffect, useRef } from "react";

/**
 * Attache la source a l'element de lecture et relance la lecture si elle etait
 * en cours.
 *
 * L'adresse renvoie vers le stockage par une redirection signee : c'est lui
 * qui sert les octets et repond aux requetes partielles, donc le deplacement
 * dans un morceau fonctionne sans que l'application ait a s'en meler.
 */
export default function useMediaSource(mediaRef, track, { shouldPlay = false } = {}) {
  // Lue au moment ou la source devient prete, sans relancer l'effet : le
  // rebrancher a chaque pause recreerait la lecture depuis le debut.
  const shouldPlayRef = useRef(shouldPlay);
  shouldPlayRef.current = shouldPlay;

  useEffect(() => {
    const media = mediaRef.current;
    if (!media || !track) return undefined;

    let annule = false;
    media.src = track.streamUrl;
    media.load();

    if (shouldPlayRef.current) {
      media.play().catch(() => {
        // Lecture refusee par le navigateur, faute de geste utilisateur.
      });
    }

    return () => {
      annule = true;
      if (annule) media.pause();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [track?.id, track?.streamUrl]);
}
