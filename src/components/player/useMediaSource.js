"use client";

import { useEffect, useRef } from "react";

/**
 * Attache le bon flux a l'element de lecture.
 *
 * Un clip decoupe en HLS se lit nativement sur Safari et iOS ; ailleurs il
 * faut hls.js, charge seulement quand un clip en a besoin — inutile d'imposer
 * cette bibliotheque a qui n'ecoute que de l'audio, surtout en donnees
 * mobiles.
 */
export default function useMediaSource(mediaRef, track, { dataSaver = false, shouldPlay = false } = {}) {
  const hlsRef = useRef(null);

  // Lue au moment ou la source devient prete, sans relancer l'effet : le
  // rebrancher a chaque pause detruirait et recreerait le lecteur HLS.
  const shouldPlayRef = useRef(shouldPlay);
  shouldPlayRef.current = shouldPlay;

  useEffect(() => {
    const media = mediaRef.current;
    if (!media || !track) return undefined;

    let annule = false;

    function detruire() {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    }

    detruire();

    /** La source vient d'etre posee : on reprend la lecture si elle etait en cours. */
    function demarrerSiBesoin() {
      if (!annule && shouldPlayRef.current) media.play().catch(() => {});
    }

    function fichierComplet() {
      media.src = track.streamUrl;
      media.load();
      demarrerSiBesoin();
    }

    const natif = media.canPlayType("application/vnd.apple.mpegurl");
    if (track.hlsUrl && !natif) {
      import("hls.js").then(({ default: Hls }) => {
        if (annule) return;
        if (!Hls.isSupported()) {
          // Navigateur sans Media Source : on retombe sur le fichier complet.
          fichierComplet();
          return;
        }

        const hls = new Hls({
          // Pas de plafond lie a la taille affichee : le lecteur est parfois
          // reduit a quelques pixels (audio joue en arriere-plan), ce qui
          // bloquerait le choix d'une definition.
          capLevelToPlayerSize: false,
          startLevel: dataSaver ? 0 : -1,
          maxBufferLength: dataSaver ? 10 : 30,
        });

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          if (dataSaver) hls.currentLevel = 0;
          demarrerSiBesoin();
        });
        hls.on(Hls.Events.ERROR, (_evenement, donnees) => {
          // Une erreur reseau irrecuperable vaut mieux qu'un lecteur muet :
          // on repasse au fichier complet.
          if (donnees.fatal) {
            console.warn(
              `Lecture HLS impossible (${donnees.type} / ${donnees.details}) : retour au fichier complet.`,
            );
            hls.destroy();
            hlsRef.current = null;
            fichierComplet();
          }
        });

        hls.loadSource(track.hlsUrl);
        hls.attachMedia(media);
        hlsRef.current = hls;
      });
    } else if (track.hlsUrl && natif) {
      media.src = track.hlsUrl;
      media.load();
      demarrerSiBesoin();
    } else {
      fichierComplet();
    }

    return () => {
      annule = true;
      detruire();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [track?.id, track?.hlsUrl, track?.streamUrl, dataSaver]);
}
