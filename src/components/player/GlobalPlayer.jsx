"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useDispatch, useSelector } from "react-redux";
import {
  HiArrowPath,
  HiArrowsRightLeft,
  HiBackward,
  HiChevronDown,
  HiChevronUp,
  HiForward,
  HiPause,
  HiPlay,
  HiQueueList,
  HiSignal,
  HiSignalSlash,
  HiSpeakerWave,
  HiSpeakerXMark,
  HiXMark,
} from "react-icons/hi2";
import Cover from "@/components/Cover";
import FileAttente from "@/components/FileAttente";
import useMediaSource from "@/components/player/useMediaSource";
import DownloadButton from "@/components/DownloadButton";
import FavouriteButton from "@/components/FavouriteButton";
import {
  closePlayer,
  cycleRepeat,
  next,
  playPause,
  previous,
  setDataSaver,
  setFullScreen,
  setProgress,
  setVolume,
  toggleMute,
  toggleShuffle,
} from "@/redux/features/playerSlice";
import { formatDuration } from "@/lib/format";

/**
 * Lecteur unique pour tout le site.
 *
 * Un seul element <video> sert l'audio et la video : un fichier MP3 s'y lit
 * sans image, un clip y affiche sa piste video. Cela evite deux moteurs de
 * lecture concurrents et garde une seule file d'attente.
 */
export default function GlobalPlayer() {
  const dispatch = useDispatch();
  const mediaRef = useRef(null);
  const [buffered, setBuffered] = useState(0);
  const [fileOuverte, setFileOuverte] = useState(false);
  const {
    current,
    isPlaying,
    volume,
    muted,
    repeat,
    shuffle,
    fullScreen,
    dataSaver,
    progress,
    queue,
    index,
  } = useSelector((state) => state.player);

  const isVideo = current?.kind === "video";

  // Choix du flux (fichier complet ou HLS) selon le morceau et le navigateur.
  useMediaSource(mediaRef, current, { dataSaver, shouldPlay: isPlaying });

  // La preference d'economie de donnees appartient a l'appareil, pas au compte :
  // le meme auditeur la veut sur son telephone et pas sur son ordinateur.
  useEffect(() => {
    try {
      const enregistre = window.localStorage.getItem("faso-zik:economie");
      if (enregistre === "1") dispatch(setDataSaver(true));
    } catch {
      /* stockage indisponible : on garde la valeur par defaut */
    }
  }, [dispatch]);

  useEffect(() => {
    const media = mediaRef.current;
    if (!media || !current) return;
    if (isPlaying) media.play().catch(() => dispatch(playPause(false)));
    else media.pause();
  }, [isPlaying, current, dispatch]);

  useEffect(() => {
    const media = mediaRef.current;
    if (!media) return;
    media.volume = volume;
    media.muted = muted;
  }, [volume, muted]);

  // Touches globales : espace = lecture/pause, fleches = piste precedente/suivante.
  useEffect(() => {
    function onKey(event) {
      const tag = event.target?.tagName;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(tag) || event.target?.isContentEditable) return;
      if (event.code === "Space") {
        event.preventDefault();
        dispatch(playPause());
      } else if (event.code === "ArrowRight" && event.shiftKey) {
        dispatch(next());
      } else if (event.code === "ArrowLeft" && event.shiftKey) {
        dispatch(previous());
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dispatch]);

  const onTimeUpdate = useCallback(() => {
    const media = mediaRef.current;
    if (!media) return;
    dispatch(
      setProgress({ position: media.currentTime, duration: media.duration || current?.duration || 0 }),
    );
    if (media.buffered.length) {
      setBuffered(media.buffered.end(media.buffered.length - 1));
    }
  }, [dispatch, current?.duration]);

  const onEnded = useCallback(() => {
    const media = mediaRef.current;
    if (repeat === "one" && media) {
      media.currentTime = 0;
      media.play().catch(() => {});
      return;
    }
    dispatch(next());
  }, [dispatch, repeat]);

  function seek(event) {
    const media = mediaRef.current;
    if (!media) return;
    const value = Number(event.target.value);
    media.currentTime = value;
    dispatch(setProgress({ ...progress, position: value }));
  }

  if (!current) return null;

  const duration = progress.duration || current.duration || 0;

  return (
    <>
      {/* Element de lecture : monte une seule fois, deplace visuellement selon le mode. */}
      <div
        className={
          fullScreen && isVideo
            ? "fixed inset-0 z-[60] bg-black"
            : // Jamais display:none : l'element doit rester rendu pour continuer a jouer.
              "pointer-events-none fixed bottom-0 left-0 h-px w-px overflow-hidden opacity-0"
        }
      >
        <video
          ref={mediaRef}
          playsInline
          onTimeUpdate={onTimeUpdate}
          onEnded={onEnded}
          onPlay={() => dispatch(playPause(true))}
          onPause={() => dispatch(playPause(false))}
          className="h-full w-full object-contain"
        />
        <button
          type="button"
          onClick={() => dispatch(setFullScreen(false))}
          className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-xl text-white backdrop-blur"
          aria-label="Quitter le plein ecran"
        >
          <HiChevronDown />
        </button>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-faso-line bg-faso-panel/95 backdrop-blur-xl">
        <input
          type="range"
          min={0}
          max={duration || 0}
          step="0.1"
          value={Math.min(progress.position, duration || 0)}
          onChange={seek}
          aria-label="Position de lecture"
          className="!h-1 !rounded-none"
          style={{
            background: `linear-gradient(to right, #FCD116 ${
              duration ? (progress.position / duration) * 100 : 0
            }%, rgba(255,255,255,0.25) ${
              duration ? (buffered / duration) * 100 : 0
            }%, rgba(255,255,255,0.12) 0%)`,
          }}
        />

        <div className="mx-auto flex max-w-[1600px] items-center gap-3 px-3 py-2 sm:gap-4 sm:px-4">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <button
              type="button"
              onClick={() => isVideo && dispatch(setFullScreen(true))}
              className="relative h-12 w-12 shrink-0 overflow-hidden rounded"
              aria-label={isVideo ? "Afficher le clip en plein ecran" : current.title}
            >
              <Cover src={current.coverUrl} alt={current.title} rounded="rounded" />
              {isVideo && (
                <span className="absolute inset-0 flex items-center justify-center bg-black/40 text-white">
                  <HiChevronUp />
                </span>
              )}
            </button>
            <div className="min-w-0">
              <Link
                href={`/titre/${current.id}`}
                className="block truncate text-sm font-semibold text-white"
              >
                {current.title}
              </Link>
              <Link
                href={`/artistes/${current.artist.slug}`}
                className="block truncate text-xs text-white/50"
              >
                {current.artist.name}
              </Link>
            </div>
            <div className="hidden items-center gap-3 pl-2 sm:flex">
              <FavouriteButton trackId={current.id} />
              <DownloadButton track={current} />
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            <button
              type="button"
              onClick={() => dispatch(toggleShuffle())}
              aria-label="Lecture aleatoire"
              aria-pressed={shuffle}
              className={`hidden p-2 text-lg sm:block ${shuffle ? "text-faso-gold" : "text-white/45 hover:text-white"}`}
            >
              <HiArrowsRightLeft />
            </button>
            <button
              type="button"
              onClick={() => dispatch(previous())}
              aria-label="Titre precedent"
              className="p-2 text-xl text-white/70 hover:text-white"
            >
              <HiBackward />
            </button>
            <button
              type="button"
              onClick={() => dispatch(playPause())}
              aria-label={isPlaying ? "Pause" : "Lecture"}
              className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-faso-gold text-2xl text-black transition hover:scale-105"
            >
              {isPlaying ? <HiPause /> : <HiPlay className="translate-x-[1px]" />}
            </button>
            <button
              type="button"
              onClick={() => dispatch(next())}
              aria-label="Titre suivant"
              className="p-2 text-xl text-white/70 hover:text-white"
            >
              <HiForward />
            </button>
            <button
              type="button"
              onClick={() => dispatch(cycleRepeat())}
              aria-label={`Repetition : ${repeat}`}
              className={`hidden p-2 text-lg sm:block ${repeat === "off" ? "text-white/45 hover:text-white" : "text-faso-gold"}`}
            >
              <HiArrowPath />
              {repeat === "one" && <span className="ml-0.5 text-[9px] font-bold">1</span>}
            </button>
          </div>

          <div className="hidden flex-1 items-center justify-end gap-3 md:flex">
            <span className="text-xs tabular-nums text-white/45">
              {formatDuration(progress.position)} / {formatDuration(duration)}
            </span>
            <button
              type="button"
              onClick={() => {
                const suivant = !dataSaver;
                dispatch(setDataSaver(suivant));
                try {
                  window.localStorage.setItem("faso-zik:economie", suivant ? "1" : "0");
                } catch {
                  /* preference non conservee : sans consequence sur la lecture */
                }
              }}
              aria-pressed={dataSaver}
              aria-label={
                dataSaver ? "Desactiver l'economie de donnees" : "Activer l'economie de donnees"
              }
              title={
                dataSaver
                  ? "Economie de donnees active : definition minimale"
                  : "Economie de donnees"
              }
              className={`text-lg ${dataSaver ? "text-faso-green" : "text-white/40 hover:text-white"}`}
            >
              {dataSaver ? <HiSignalSlash /> : <HiSignal />}
            </button>
            <button
              type="button"
              onClick={() => dispatch(toggleMute())}
              aria-label={muted ? "Retablir le son" : "Couper le son"}
              className="text-lg text-white/60 hover:text-white"
            >
              {muted || volume === 0 ? <HiSpeakerXMark /> : <HiSpeakerWave />}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={muted ? 0 : volume}
              onChange={(event) => dispatch(setVolume(Number(event.target.value)))}
              aria-label="Volume"
              className="w-24"
            />
            <button
              type="button"
              onClick={() => setFileOuverte((etat) => !etat)}
              aria-label="File d'attente"
              aria-expanded={fileOuverte}
              className={`flex items-center gap-1 text-lg ${
                fileOuverte ? "text-faso-gold" : "text-white/45 hover:text-white"
              }`}
            >
              <HiQueueList />
              {queue.length > 1 && (
                <span className="text-[11px] tabular-nums">
                  {index + 1}/{queue.length}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => dispatch(closePlayer())}
              aria-label="Fermer le lecteur"
              className="text-lg text-white/40 hover:text-white"
            >
              <HiXMark />
            </button>
          </div>
        </div>
      </div>

      <FileAttente ouvert={fileOuverte} onFermer={() => setFileOuverte(false)} />
    </>
  );
}
