"use client";

import { useDispatch, useSelector } from "react-redux";
import { HiPause, HiPlay } from "react-icons/hi2";
import { playPause, playTrack } from "@/redux/features/playerSlice";

/** Bouton lecture/pause : relit l'etat global pour rester synchrone partout. */
export default function PlayButton({ track, queue, size = "md", className = "" }) {
  const dispatch = useDispatch();
  const { current, isPlaying } = useSelector((state) => state.player);
  const isCurrent = current?.id === track?.id;
  const active = isCurrent && isPlaying;

  const sizes = {
    sm: "h-8 w-8 text-base",
    md: "h-10 w-10 text-lg",
    lg: "h-14 w-14 text-2xl",
  };

  return (
    <button
      type="button"
      aria-label={active ? `Mettre en pause ${track.title}` : `Lire ${track.title}`}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        if (isCurrent) dispatch(playPause(!isPlaying));
        else dispatch(playTrack({ track, queue }));
      }}
      className={`${sizes[size]} inline-flex items-center justify-center rounded-full bg-faso-gold text-black shadow-lg transition hover:scale-105 hover:bg-faso-gold/90 ${className}`}
    >
      {active ? <HiPause /> : <HiPlay className="translate-x-[1px]" />}
    </button>
  );
}
