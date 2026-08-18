"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { HiPlay, HiTrash } from "react-icons/hi2";
import { useDispatch } from "react-redux";
import { playTrack } from "@/redux/features/playerSlice";
import TrackList from "@/components/TrackList";

export default function PlaylistManager({ initialPlaylists }) {
  const dispatch = useDispatch();
  const [playlists, setPlaylists] = useState(initialPlaylists);
  const [name, setName] = useState("");
  const [opened, setOpened] = useState(null);

  async function create(event) {
    event.preventDefault();
    if (!name.trim()) return;
    const response = await fetch("/api/playlists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() }),
    });
    const data = await response.json();
    if (!response.ok) {
      toast.error(data.error);
      return;
    }
    setPlaylists((list) => [{ ...data.playlist, track_count: 0 }, ...list]);
    setName("");
    toast.success("Playlist creee.");
  }

  async function open(id) {
    if (opened?.id === id) {
      setOpened(null);
      return;
    }
    const response = await fetch(`/api/playlists/${id}`);
    const data = await response.json();
    if (!response.ok) {
      toast.error(data.error);
      return;
    }
    setOpened(data.playlist);
  }

  async function remove(id) {
    const response = await fetch(`/api/playlists/${id}`, { method: "DELETE" });
    if (!response.ok) {
      toast.error("Suppression impossible.");
      return;
    }
    setPlaylists((list) => list.filter((item) => item.id !== id));
    if (opened?.id === id) setOpened(null);
    toast.success("Playlist supprimee.");
  }

  return (
    <div className="flex flex-col gap-5">
      <h1 className="section-title">Mes playlists</h1>

      <form onSubmit={create} className="flex gap-2">
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Nom de la nouvelle playlist"
          className="input max-w-sm"
          aria-label="Nom de la playlist"
        />
        <button type="submit" className="btn-primary">
          Creer
        </button>
      </form>

      {playlists.length === 0 && (
        <p className="rounded-lg border border-dashed border-faso-line p-6 text-sm text-white/40">
          Aucune playlist. Creez-en une puis ajoutez-y des titres.
        </p>
      )}

      <div className="flex flex-col gap-3">
        {playlists.map((playlist) => (
          <div key={playlist.id} className="card !p-0">
            <div className="flex items-center gap-3 p-3">
              <button
                type="button"
                onClick={() => open(playlist.id)}
                className="min-w-0 flex-1 text-left"
              >
                <span className="block truncate text-sm font-semibold text-white">
                  {playlist.name}
                </span>
                <span className="text-xs text-white/40">
                  {playlist.track_count ?? playlist.tracks?.length ?? 0} titre(s)
                </span>
              </button>

              {opened?.id === playlist.id && opened.tracks.length > 0 && (
                <button
                  type="button"
                  onClick={() =>
                    dispatch(playTrack({ track: opened.tracks[0], queue: opened.tracks }))
                  }
                  className="btn-ghost !px-3 !py-1.5"
                >
                  <HiPlay /> Lire
                </button>
              )}

              <button
                type="button"
                onClick={() => remove(playlist.id)}
                aria-label={`Supprimer ${playlist.name}`}
                className="p-2 text-white/35 hover:text-faso-red"
              >
                <HiTrash />
              </button>
            </div>

            {opened?.id === playlist.id && (
              <div className="border-t border-faso-line p-2">
                <TrackList tracks={opened.tracks} empty="Playlist vide pour l'instant." />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
