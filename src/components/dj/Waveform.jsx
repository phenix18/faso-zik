"use client";

import { useEffect, useRef } from "react";

/**
 * Forme d'onde d'une platine : creetes du morceau, portion deja jouee,
 * zone de boucle, repere de cue. Un clic deplace la tete de lecture.
 */
export default function Waveform({ peaks, position, duration, loop, cuePoint, colour, onSeek }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ratio = window.devicePixelRatio || 1;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    canvas.width = width * ratio;
    canvas.height = height * ratio;

    const context = canvas.getContext("2d");
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, width, height);

    context.fillStyle = "rgba(255,255,255,0.04)";
    context.fillRect(0, 0, width, height);

    if (!peaks?.length) {
      context.fillStyle = "rgba(255,255,255,0.25)";
      context.font = "11px sans-serif";
      context.fillText("Aucun morceau charge", 10, height / 2);
      return;
    }

    const played = duration ? (position / duration) * width : 0;
    const middle = height / 2;
    const step = width / peaks.length;

    for (let index = 0; index < peaks.length; index += 1) {
      const amplitude = Math.max(peaks[index] * middle * 0.95, 0.5);
      const x = index * step;
      context.fillStyle = x <= played ? colour : "rgba(255,255,255,0.28)";
      context.fillRect(x, middle - amplitude, Math.max(step - 0.4, 0.6), amplitude * 2);
    }

    if (loop && duration) {
      const start = (loop.start / duration) * width;
      const end = (loop.end / duration) * width;
      context.fillStyle = "rgba(252,209,22,0.18)";
      context.fillRect(start, 0, Math.max(end - start, 2), height);
      context.strokeStyle = "rgba(252,209,22,0.8)";
      context.lineWidth = 1;
      context.strokeRect(start, 0.5, Math.max(end - start, 2), height - 1);
    }

    if (duration) {
      const cueX = (cuePoint / duration) * width;
      context.fillStyle = "#EF3340";
      context.fillRect(cueX - 1, 0, 2, height);

      context.fillStyle = "#FFFFFF";
      context.fillRect(played - 1, 0, 2, height);
    }
  }, [peaks, position, duration, loop, cuePoint, colour]);

  return (
    <canvas
      ref={canvasRef}
      role="img"
      aria-label="Forme d'onde du morceau charge"
      onClick={(event) => {
        if (!duration) return;
        const rect = event.currentTarget.getBoundingClientRect();
        onSeek(((event.clientX - rect.left) / rect.width) * duration);
      }}
      className="h-20 w-full cursor-crosshair rounded-lg border border-faso-line"
    />
  );
}
