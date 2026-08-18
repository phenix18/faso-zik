"use client";

import Link from "next/link";
import { useSelector } from "react-redux";
import { HiVideoCamera } from "react-icons/hi2";
import Cover from "@/components/Cover";
import PlayButton from "@/components/PlayButton";
import DownloadButton from "@/components/DownloadButton";
import FavouriteButton from "@/components/FavouriteButton";
import { formatCount, formatDuration } from "@/lib/format";

export default function TrackRow({ track, queue, index, showFavourite = true }) {
  const { current, isPlaying } = useSelector((state) => state.player);
  const isCurrent = current?.id === track.id;

  return (
    <div
      className={`flex items-center gap-3 rounded-lg px-2 py-2 transition hover:bg-white/5 ${
        isCurrent ? "bg-white/5" : ""
      }`}
    >
      {typeof index === "number" && (
        <span className="hidden w-6 shrink-0 text-center text-xs text-white/30 sm:block">
          {isCurrent && isPlaying ? (
            <span className="inline-flex h-3 items-end gap-[2px]">
              <i className="block h-full w-[2px] origin-bottom animate-equalize bg-faso-gold" />
              <i className="block h-full w-[2px] origin-bottom animate-equalize bg-faso-gold [animation-delay:0.15s]" />
              <i className="block h-full w-[2px] origin-bottom animate-equalize bg-faso-gold [animation-delay:0.3s]" />
            </span>
          ) : (
            index + 1
          )}
        </span>
      )}

      <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded">
        <Cover src={track.coverUrl} alt={track.title} rounded="rounded" />
      </div>

      <div className="min-w-0 flex-1">
        <Link
          href={`/titre/${track.id}`}
          className={`flex items-center gap-1.5 truncate text-sm font-semibold ${
            isCurrent ? "text-faso-gold" : "text-white"
          }`}
        >
          {track.kind === "video" && <HiVideoCamera className="shrink-0 text-white/50" />}
          <span className="truncate">{track.title}</span>
        </Link>
        <Link
          href={`/artistes/${track.artist.slug}`}
          className="block truncate text-xs text-white/45 hover:text-white/80"
        >
          {track.artist.name}
          {track.genre ? ` · ${track.genre}` : ""}
        </Link>
      </div>

      <span className="hidden shrink-0 text-xs text-white/35 sm:block">
        {formatCount(track.plays)} ecoutes
      </span>
      <span className="shrink-0 text-xs text-white/35">{formatDuration(track.duration)}</span>

      <div className="flex shrink-0 items-center gap-3">
        {showFavourite && <FavouriteButton trackId={track.id} />}
        <DownloadButton track={track} />
        <PlayButton track={track} queue={queue} size="sm" />
      </div>
    </div>
  );
}
