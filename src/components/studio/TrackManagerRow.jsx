"use client";

import { useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { HiTrash, HiVideoCamera } from "react-icons/hi2";
import Cover from "@/components/Cover";
import { formatCount, formatDuration, formatSize } from "@/lib/format";


const SWITCHES = [
  ["published", "En ligne", "Le titre apparait dans le catalogue public."],
  ["allowDownload", "Telechargement", "Les auditeurs peuvent enregistrer le fichier."],
  ["allowDj", "Platine DJ", "Le titre peut etre charge dans la platine du site."],
];

export default function TrackManagerRow({ track, onChange, onDelete }) {
  const [pending, setPending] = useState(null);
  const [prix, setPrix] = useState(track.priceCfa);

  const values = {
    published: track.published,
    allowDownload: track.permissions.download,
    allowDj: track.permissions.dj,
  };

  async function toggle(field) {
    setPending(field);
    try {
      const response = await fetch(`/api/tracks/${track.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: !values[field] }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      onChange(data.track);
    } catch (error) {
      toast.error(error.message || "Modification impossible.");
    } finally {
      setPending(null);
    }
  }

  /** Prix du telechargement ; zero rend le titre gratuit. */
  async function enregistrerPrix() {
    const valeur = Math.max(0, Math.round(Number(prix) || 0));
    if (valeur === track.priceCfa) return;

    setPending("prix");
    try {
      const response = await fetch(`/api/tracks/${track.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceCfa: valeur }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      onChange(data.track);
      toast.success(valeur ? `Prix fixe a ${valeur} F CFA.` : "Titre rendu gratuit.");
    } catch (error) {
      setPrix(track.priceCfa);
      toast.error(error.message || "Prix non enregistre.");
    } finally {
      setPending(null);
    }
  }

  async function remove() {
    if (!window.confirm(`Supprimer definitivement « ${track.title} » ?`)) return;
    const response = await fetch(`/api/tracks/${track.id}`, { method: "DELETE" });
    if (!response.ok) {
      toast.error("Suppression impossible.");
      return;
    }
    onDelete(track.id);
    toast.success("Titre supprime.");
  }

  return (
    <div className="card flex flex-col gap-3 !p-3 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span className="h-12 w-12 shrink-0 overflow-hidden rounded">
          <Cover src={track.coverUrl} alt={track.title} rounded="rounded" />
        </span>
        <div className="min-w-0">
          <Link
            href={`/titre/${track.id}`}
            className="flex items-center gap-1.5 truncate text-sm font-semibold text-white hover:text-faso-gold"
          >
            {track.kind === "video" && <HiVideoCamera className="shrink-0 text-white/50" />}
            <span className="truncate">{track.title}</span>
          </Link>
          <p className="truncate text-[11px] text-white/40">
            {formatDuration(track.duration)} · {formatSize(track.size)}
            {track.streamSize !== track.size && (
              <span className="text-faso-green"> → {formatSize(track.streamSize)} a l&apos;ecoute</span>
            )}{" "}
            · {formatCount(track.plays)} ecoutes · {formatCount(track.downloads)} telechargements
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        {SWITCHES.map(([field, label, hint]) => (
          <label key={field} className="flex cursor-pointer items-center gap-2" title={hint}>
            <input
              type="checkbox"
              checked={values[field]}
              disabled={pending === field}
              onChange={() => toggle(field)}
              className="h-4 w-4 accent-faso-gold"
            />
            <span className="text-xs font-medium text-white/70">{label}</span>
          </label>
        ))}

        <label
          className="flex items-center gap-1.5"
          title="Prix du telechargement. Zero = gratuit."
        >
          <input
            type="number"
            min={0}
            step={100}
            value={prix}
            disabled={!values.allowDownload || pending === "prix"}
            onChange={(evenement) => setPrix(evenement.target.value)}
            onBlur={enregistrerPrix}
            aria-label={`Prix de ${track.title} en francs CFA`}
            className="input w-24 !py-1 text-xs disabled:opacity-40"
          />
          <span className="text-[11px] text-white/45">F CFA</span>
        </label>

        <button
          type="button"
          onClick={remove}
          aria-label={`Supprimer ${track.title}`}
          className="p-2 text-white/30 hover:text-faso-red"
        >
          <HiTrash />
        </button>
      </div>
    </div>
  );
}
