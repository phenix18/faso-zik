"use client";

import { useState } from "react";
import Link from "next/link";
import UploadForm from "@/components/studio/UploadForm";
import TrackManagerRow from "@/components/studio/TrackManagerRow";
import RevenusArtiste from "@/components/studio/RevenusArtiste";
import AlbumsArtiste from "@/components/studio/AlbumsArtiste";
import { formatCount } from "@/lib/format";

const TABS = [
  ["catalogue", "Mon catalogue"],
  ["publier", "Publier un titre"],
  ["albums", "Mes albums"],
  ["revenus", "Mes revenus"],
  ["profil", "Ma fiche artiste"],
];

export default function StudioClient({ artist, initialTracks, stats, revenus, paiements, albums }) {
  const [tab, setTab] = useState("catalogue");
  const [tracks, setTracks] = useState(initialTracks);

  const cards = [
    ["Titres publies", stats.tracks],
    ["Ecoutes", formatCount(stats.plays)],
    ["Telechargements", formatCount(stats.downloads)],
    ["Clips", stats.videos],
    ["Telechargeables", stats.downloadable],
    ["Ouverts aux DJ", stats.dj_ready],
  ];

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-faso-gold">Studio</p>
          <h1 className="text-2xl font-black text-white">{artist.name}</h1>
          <Link
            href={`/artistes/${artist.slug}`}
            className="text-xs text-white/45 hover:text-faso-gold"
          >
            Voir ma page publique →
          </Link>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {cards.map(([label, value]) => (
          <div key={label} className="card !p-3">
            <p className="text-[11px] uppercase tracking-wide text-white/40">{label}</p>
            <p className="mt-1 text-xl font-black text-white">{value}</p>
          </div>
        ))}
      </div>

      <nav className="flex gap-2 border-b border-faso-line">
        {TABS.map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setTab(value)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-semibold transition ${
              tab === value
                ? "border-faso-gold text-faso-gold"
                : "border-transparent text-white/45 hover:text-white"
            }`}
          >
            {label}
          </button>
        ))}
      </nav>

      {tab === "catalogue" && (
        <section className="flex flex-col gap-2">
          <div className="rounded-lg border border-faso-line bg-black/30 p-3 text-xs text-white/50">
            Chaque interrupteur ci-dessous est une autorisation que vous accordez. Le serveur refuse
            tout telechargement ou chargement en platine qui n&apos;est pas coche ici.
          </div>

          {tracks.length === 0 ? (
            <p className="rounded-lg border border-dashed border-faso-line p-6 text-sm text-white/40">
              Aucun titre publie. Passez a l&apos;onglet « Publier un titre ».
            </p>
          ) : (
            tracks.map((track) => (
              <TrackManagerRow
                key={track.id}
                track={track}
                onChange={(updated) =>
                  setTracks((list) => list.map((item) => (item.id === updated.id ? updated : item)))
                }
                onDelete={(id) => setTracks((list) => list.filter((item) => item.id !== id))}
              />
            ))
          )}
        </section>
      )}

      {tab === "publier" && (
        <UploadForm
          albums={albums}
          onPublished={(track) => setTracks((list) => [track, ...list])}
        />
      )}

      {tab === "albums" && (
        <AlbumsArtiste artiste={artist} albumsInitiaux={albums} titres={tracks} />
      )}

      {tab === "revenus" && <RevenusArtiste revenus={revenus} paiements={paiements} />}

      {tab === "profil" && <ProfileForm artist={artist} />}
    </div>
  );
}

function ProfileForm({ artist }) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    const response = await fetch("/api/artist", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"),
        bio: form.get("bio"),
        city: form.get("city"),
        country: form.get("country"),
        genres: form.get("genres"),
      }),
    });
    setPending(false);
    setMessage(response.ok ? "Fiche mise a jour." : "Mise a jour impossible.");
  }

  return (
    <form onSubmit={submit} className="card flex max-w-xl flex-col gap-3">
      <div>
        <label className="label" htmlFor="name">
          Nom d&apos;artiste
        </label>
        <input id="name" name="name" defaultValue={artist.name} className="input" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="city">
            Ville
          </label>
          <input id="city" name="city" defaultValue={artist.city || ""} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="country">
            Pays
          </label>
          <input id="country" name="country" defaultValue={artist.country || ""} className="input" />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="genres">
          Genres (separes par des virgules)
        </label>
        <input
          id="genres"
          name="genres"
          defaultValue={artist.genres || ""}
          placeholder="Afrobeat, Coupe-decale, Balafon"
          className="input"
        />
      </div>
      <div>
        <label className="label" htmlFor="bio">
          Presentation
        </label>
        <textarea id="bio" name="bio" rows={5} defaultValue={artist.bio || ""} className="input" />
      </div>
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? "Enregistrement..." : "Enregistrer"}
        </button>
        {message && <span className="text-xs text-white/50">{message}</span>}
      </div>
    </form>
  );
}
