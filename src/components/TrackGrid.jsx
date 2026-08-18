"use client";

import TrackCard from "@/components/TrackCard";

export default function TrackGrid({ tracks = [], empty = "Aucun titre pour le moment." }) {
  if (!tracks.length) {
    return <p className="rounded-lg border border-dashed border-faso-line p-6 text-sm text-white/40">{empty}</p>;
  }
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
      {tracks.map((track) => (
        <TrackCard key={track.id} track={track} queue={tracks} />
      ))}
    </div>
  );
}
