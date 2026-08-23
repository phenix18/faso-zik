"use client";

import { useEffect, useRef, useState } from "react";
import { HiPause, HiPlay } from "react-icons/hi2";
import Cover from "@/components/Cover";
import { formatDuration } from "@/lib/format";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "";

/**
 * Lecteur autonome, sans dependance a l'etat global : il tourne dans le cadre
 * d'un autre site, ou le magasin Redux du site n'existe pas.
 */
export default function LecteurIntegre({ track }) {
  const mediaRef = useRef(null);
  const [enLecture, setEnLecture] = useState(false);
  const [position, setPosition] = useState(0);
  const duree = track.duration || 0;

  useEffect(() => {
    const media = mediaRef.current;
    if (!media) return undefined;

    const surTemps = () => setPosition(media.currentTime);
    const surFin = () => setEnLecture(false);
    media.addEventListener("timeupdate", surTemps);
    media.addEventListener("ended", surFin);
    return () => {
      media.removeEventListener("timeupdate", surTemps);
      media.removeEventListener("ended", surFin);
    };
  }, []);

  function basculer() {
    const media = mediaRef.current;
    if (!media) return;
    if (enLecture) {
      media.pause();
      setEnLecture(false);
    } else {
      media.play().then(() => setEnLecture(true)).catch(() => setEnLecture(false));
    }
  }

  return (
    <div className="flex items-center gap-3 rounded-xl border border-faso-line bg-faso-panel p-3">
      <audio ref={mediaRef} src={track.streamUrl} preload="none" />

      <span className="h-16 w-16 shrink-0 overflow-hidden rounded-lg">
        <Cover src={track.coverUrl} alt={track.title} rounded="rounded-lg" />
      </span>

      <div className="min-w-0 flex-1">
        <a
          href={`${SITE}/titre/${track.id}`}
          target="_blank"
          rel="noreferrer"
          className="block truncate text-sm font-bold text-white hover:text-faso-gold"
        >
          {track.title}
        </a>
        <a
          href={`${SITE}/artistes/${track.artist.slug}`}
          target="_blank"
          rel="noreferrer"
          className="block truncate text-xs text-white/50 hover:text-white"
        >
          {track.artist.name}
        </a>

        <div className="mt-2 flex items-center gap-2">
          <input
            type="range"
            min={0}
            max={duree || 0}
            step="0.1"
            value={Math.min(position, duree)}
            onChange={(evenement) => {
              const valeur = Number(evenement.target.value);
              if (mediaRef.current) mediaRef.current.currentTime = valeur;
              setPosition(valeur);
            }}
            aria-label="Position de lecture"
            className="flex-1"
          />
          <span className="shrink-0 text-[11px] tabular-nums text-white/40">
            {formatDuration(position)} / {formatDuration(duree)}
          </span>
        </div>
      </div>

      <button
        type="button"
        onClick={basculer}
        aria-label={enLecture ? "Pause" : "Lecture"}
        className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-faso-gold text-xl text-black"
      >
        {enLecture ? <HiPause /> : <HiPlay className="translate-x-[1px]" />}
      </button>

      <a
        href={SITE || "/"}
        target="_blank"
        rel="noreferrer"
        className="hidden shrink-0 text-[10px] font-black tracking-tight text-white/30 hover:text-faso-gold sm:block"
      >
        FASO<span className="text-faso-gold">-</span>ZIK
      </a>
    </div>
  );
}
