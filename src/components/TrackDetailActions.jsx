"use client";

import { useState } from "react";
import { useDispatch } from "react-redux";
import { HiPlay, HiQueueList, HiShoppingBag } from "react-icons/hi2";
import toast from "react-hot-toast";
import { enqueue, playTrack } from "@/redux/features/playerSlice";
import DownloadButton from "@/components/DownloadButton";
import FavouriteButton from "@/components/FavouriteButton";
import PaiementForm from "@/components/PaiementForm";
import BoutonIntegrer from "@/components/BoutonIntegrer";
import AjouterAPlaylist from "@/components/AjouterAPlaylist";
import { formatCfa } from "@/lib/format";

export default function TrackDetailActions({ track }) {
  const dispatch = useDispatch();
  const [achatOuvert, setAchatOuvert] = useState(false);
  const payant = track.permissions.downloadPaid;

  return (
    <>
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

      {payant ? (
        <button type="button" onClick={() => setAchatOuvert((ouvert) => !ouvert)} className="btn-ghost">
          <HiShoppingBag className="text-lg" /> Acheter {formatCfa(track.priceCfa)}
        </button>
      ) : (
        <DownloadButton track={track} withLabel className="btn-ghost" />
      )}
      {track.kind === "audio" && <BoutonIntegrer trackId={track.id} />}
      <AjouterAPlaylist trackId={track.id} className="text-2xl" />
      <FavouriteButton trackId={track.id} className="text-2xl" />
    </div>

    {payant && achatOuvert && (
      <div className="mt-4 rounded-xl border border-faso-line bg-black/40 p-4">
        <PaiementForm type="achat" track={track} onClose={() => setAchatOuvert(false)} />
      </div>
    )}
    </>
  );
}
