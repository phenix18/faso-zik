"use client";

import { useDispatch, useSelector } from "react-redux";
import { HiQueueList, HiXMark } from "react-icons/hi2";
import Cover from "@/components/Cover";
import { jumpTo, removeFromQueue } from "@/redux/features/playerSlice";
import { formatDuration } from "@/lib/format";

/** Panneau de la file d'attente, ouvert depuis le lecteur. */
export default function FileAttente({ ouvert, onFermer }) {
  const dispatch = useDispatch();
  const { queue, index } = useSelector((etat) => etat.player);

  if (!ouvert) return null;

  return (
    <div className="fixed inset-0 z-[55]">
      <button
        type="button"
        aria-label="Fermer la file d'attente"
        onClick={onFermer}
        className="absolute inset-0 bg-black/60"
      />

      <aside className="absolute bottom-20 right-0 flex max-h-[60vh] w-full flex-col rounded-t-xl border border-faso-line bg-faso-panel sm:right-4 sm:w-96 sm:rounded-xl">
        <header className="flex items-center gap-2 border-b border-faso-line p-3">
          <HiQueueList className="text-faso-gold" />
          <h2 className="flex-1 text-sm font-bold text-white">
            File d&apos;attente <span className="text-white/40">({queue.length})</span>
          </h2>
          <button
            type="button"
            onClick={onFermer}
            aria-label="Fermer"
            className="text-xl text-white/50 hover:text-white"
          >
            <HiXMark />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-2">
          {queue.length === 0 ? (
            <p className="p-4 text-sm text-white/40">La file est vide.</p>
          ) : (
            queue.map((titre, position) => (
              <div
                key={`${titre.id}-${position}`}
                className={`flex items-center gap-2 rounded-lg px-2 py-1.5 ${
                  position === index ? "bg-white/10" : "hover:bg-white/5"
                }`}
              >
                <button
                  type="button"
                  onClick={() => dispatch(jumpTo(position))}
                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                >
                  <span className="h-8 w-8 shrink-0 overflow-hidden rounded">
                    <Cover src={titre.coverUrl} alt={titre.title} rounded="rounded" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className={`block truncate text-xs font-semibold ${
                        position === index ? "text-faso-gold" : "text-white"
                      }`}
                    >
                      {titre.title}
                    </span>
                    <span className="block truncate text-[11px] text-white/40">
                      {titre.artist.name}
                    </span>
                  </span>
                  <span className="shrink-0 text-[11px] text-white/30">
                    {formatDuration(titre.duration)}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => dispatch(removeFromQueue(position))}
                  aria-label={`Retirer ${titre.title} de la file`}
                  className="shrink-0 p-1 text-white/30 hover:text-faso-red"
                >
                  <HiXMark />
                </button>
              </div>
            ))
          )}
        </div>
      </aside>
    </div>
  );
}
