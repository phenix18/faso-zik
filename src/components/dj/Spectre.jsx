"use client";

import { useEffect, useRef } from "react";

/**
 * Spectre en temps reel d'une platine.
 *
 * Il ne sert pas qu'a decorer : en un coup d'oeil, on voit si deux morceaux se
 * marchent dessus dans le bas du spectre — la faute la plus audible d'un mix.
 * Le dessin lit l'analyseur deja present dans la chaine audio ; aucun calcul
 * supplementaire n'est demande au son.
 */
export default function Spectre({ analyser, actif = false, teinte = "#e9b949" }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !analyser) return undefined;

    const ctx = canvas.getContext("2d");
    const bandes = new Uint8Array(analyser.frequencyBinCount);
    let image = 0;

    const dessiner = () => {
      image = requestAnimationFrame(dessiner);
      const { width, height } = canvas;
      analyser.getByteFrequencyData(bandes);

      ctx.clearRect(0, 0, width, height);
      const largeur = width / bandes.length;

      for (let i = 0; i < bandes.length; i += 1) {
        const valeur = bandes[i] / 255;
        const hauteur = valeur * height;
        // Les graves brillent, les aigus s'effacent : l'oeil suit le rythme.
        ctx.fillStyle = teinte;
        ctx.globalAlpha = actif ? 0.25 + valeur * 0.75 : 0.12 + valeur * 0.2;
        ctx.fillRect(i * largeur, height - hauteur, Math.max(1, largeur - 1), hauteur);
      }
      ctx.globalAlpha = 1;
    };

    dessiner();
    return () => cancelAnimationFrame(image);
  }, [analyser, actif, teinte]);

  return (
    <canvas
      ref={canvasRef}
      width={320}
      height={48}
      className="h-12 w-full rounded-md bg-black/40"
      aria-hidden="true"
    />
  );
}
