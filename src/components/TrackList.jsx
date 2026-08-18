"use client";

import TrackRow from "@/components/TrackRow";

export default function TrackList({ tracks = [], empty = "Aucun titre.", showFavourite = true }) {
  if (!tracks.length) {
    return <p className="rounded-lg border border-dashed border-faso-line p-6 text-sm text-white/40">{empty}</p>;
  }
  return (
    <div className="flex flex-col">
      {tracks.map((track, index) => (
        <TrackRow
          key={track.id}
          track={track}
          queue={tracks}
          index={index}
          showFavourite={showFavourite}
        />
      ))}
    </div>
  );
}
