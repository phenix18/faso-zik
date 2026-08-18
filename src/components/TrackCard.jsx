"use client";

import Link from "next/link";
import { useSelector } from "react-redux";
import { HiVideoCamera } from "react-icons/hi2";
import Cover from "@/components/Cover";
import PlayButton from "@/components/PlayButton";
import DownloadButton from "@/components/DownloadButton";
import { formatDuration } from "@/lib/format";

export default function TrackCard({ track, queue }) {
  const current = useSelector((state) => state.player.current);
  const isCurrent = current?.id === track.id;

  return (
    <article className="group relative w-full">
      <Link href={`/titre/${track.id}`} className="block">
        <div className="relative aspect-square w-full overflow-hidden rounded-xl border border-faso-line">
          <Cover src={track.coverUrl} alt={track.title} rounded="rounded-xl" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 transition group-hover:opacity-100" />
          {track.kind === "video" && (
            <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/70 px-2 py-1 text-[10px] font-semibold text-white">
              <HiVideoCamera /> Clip
            </span>
          )}
          <div className="absolute bottom-2 right-2 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
            <PlayButton track={track} queue={queue} />
          </div>
        </div>
      </Link>

      <div className="mt-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <Link
            href={`/titre/${track.id}`}
            className={`block truncate text-sm font-semibold ${isCurrent ? "text-faso-gold" : "text-white"}`}
          >
            {track.title}
          </Link>
          <Link
            href={`/artistes/${track.artist.slug}`}
            className="block truncate text-xs text-white/50 hover:text-white/80"
          >
            {track.artist.name}
          </Link>
        </div>
        <div className="flex shrink-0 items-center gap-2 pt-0.5">
          <span className="text-[11px] text-white/35">{formatDuration(track.duration)}</span>
          <DownloadButton track={track} />
        </div>
      </div>
    </article>
  );
}
