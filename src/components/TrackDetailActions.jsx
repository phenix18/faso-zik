"use client";

import { useDispatch } from "react-redux";
import { HiPlay, HiQueueList } from "react-icons/hi2";
import toast from "react-hot-toast";
import { enqueue, playTrack } from "@/redux/features/playerSlice";
import DownloadButton from "@/components/DownloadButton";
import FavouriteButton from "@/components/FavouriteButton";

export default function TrackDetailActions({ track }) {
  const dispatch = useDispatch();

  return (
    <div className="mt-5 flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={() => dispatch(playTrack({ track }))}
        className="btn-primary"
      >
        <HiPlay className="text-lg" />
        {track.kind === "video" ? "Regarder" : "Ecouter"}
      </button>

      <button
        type="button"
        onClick={() => {
          dispatch(enqueue(track));
          toast.success("Ajoute a la file d'attente.");
        }}
        className="btn-ghost"
      >
        <HiQueueList className="text-lg" /> File d&apos;attente
      </button>

      <DownloadButton track={track} withLabel className="btn-ghost" />
      <FavouriteButton trackId={track.id} className="text-2xl" />
    </div>
  );
}
