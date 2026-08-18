"use client";

import toast from "react-hot-toast";
import { HiArrowDownTray, HiLockClosed } from "react-icons/hi2";

/**
 * Le telechargement n'apparait que si l'artiste l'a autorise ; sinon le bouton
 * explique le refus au lieu de disparaitre silencieusement.
 */
export default function DownloadButton({ track, className = "", withLabel = false }) {
  const allowed = track?.permissions?.download;

  if (!allowed) {
    return (
      <button
        type="button"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          toast("L'artiste n'a pas autorise le telechargement de ce titre.", { icon: "🔒" });
        }}
        aria-label="Telechargement non autorise par l'artiste"
        title="Telechargement non autorise par l'artiste"
        className={`inline-flex items-center gap-2 text-white/25 ${className}`}
      >
        <HiLockClosed className="text-lg" />
        {withLabel && <span className="text-sm">Non autorise</span>}
      </button>
    );
  }

  return (
    <a
      href={track.downloadUrl}
      onClick={(event) => event.stopPropagation()}
      aria-label={`Telecharger ${track.title}`}
      title="Telecharger (autorise par l'artiste)"
      className={`inline-flex items-center gap-2 text-white/60 transition hover:text-faso-gold ${className}`}
    >
      <HiArrowDownTray className="text-lg" />
      {withLabel && <span className="text-sm font-semibold">Telecharger</span>}
    </a>
  );
}
