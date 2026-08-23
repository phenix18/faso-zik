"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import toast from "react-hot-toast";
import { HiListBullet, HiPlus } from "react-icons/hi2";

/**
 * Ajout d'un titre a une playlist.
 *
 * Les playlists ne sont chargees qu'a l'ouverture du menu : les afficher sur
 * chaque ligne d'une liste de cent titres declencherait autant de requetes.
 */
export default function AjouterAPlaylist({ trackId, className = "" }) {
  const { status } = useSession();
  const [ouvert, setOuvert] = useState(false);
  const [playlists, setPlaylists] = useState(null);
  const [nouveau, setNouveau] = useState("");
  const conteneur = useRef(null);

  useEffect(() => {
    if (!ouvert) return undefined;

    function surClicExterieur(evenement) {
      if (conteneur.current && !conteneur.current.contains(evenement.target)) setOuvert(false);
    }
    document.addEventListener("mousedown", surClicExterieur);
    return () => document.removeEventListener("mousedown", surClicExterieur);
  }, [ouvert]);

  async function ouvrir(evenement) {
    evenement.preventDefault();
    evenement.stopPropagation();

    if (status !== "authenticated") {
      toast("Connectez-vous pour utiliser vos playlists.");
      return;
    }

    setOuvert((etat) => !etat);
    if (playlists) return;

    try {
      const reponse = await fetch("/api/playlists");
      const donnees = await reponse.json();
      if (!reponse.ok) throw new Error(donnees.error);
      setPlaylists(donnees.playlists);
    } catch (erreur) {
      toast.error(erreur.message || "Playlists indisponibles.");
      setOuvert(false);
    }
  }

  async function ajouter(playlistId) {
    try {
      const reponse = await fetch(`/api/playlists/${playlistId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trackId }),
      });
      const donnees = await reponse.json();
      if (!reponse.ok) throw new Error(donnees.error);

      toast.success("Titre ajoute.");
      setOuvert(false);
    } catch (erreur) {
      toast.error(erreur.message || "Ajout impossible.");
    }
  }

  async function creerEtAjouter(evenement) {
    evenement.preventDefault();
    if (!nouveau.trim()) return;

    try {
      const reponse = await fetch("/api/playlists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: nouveau.trim() }),
      });
      const donnees = await reponse.json();
      if (!reponse.ok) throw new Error(donnees.error);

      setPlaylists((liste) => [donnees.playlist, ...(liste || [])]);
      setNouveau("");
      await ajouter(donnees.playlist.id);
    } catch (erreur) {
      toast.error(erreur.message || "Creation impossible.");
    }
  }

  return (
    <span ref={conteneur} className="relative inline-flex">
      <button
        type="button"
        onClick={ouvrir}
        aria-label="Ajouter a une playlist"
        aria-expanded={ouvert}
        title="Ajouter a une playlist"
        className={`text-lg text-white/45 transition hover:text-faso-gold ${className}`}
      >
        <HiListBullet />
      </button>

      {ouvert && (
        <div className="absolute bottom-full right-0 z-40 mb-2 w-60 rounded-xl border border-faso-line bg-faso-panel p-2 shadow-xl">
          <p className="px-2 py-1 text-[11px] uppercase tracking-wide text-white/40">
            Ajouter a une playlist
          </p>

          <div className="max-h-48 overflow-y-auto">
            {playlists === null && <p className="p-2 text-xs text-white/40">Chargement...</p>}
            {playlists?.length === 0 && (
              <p className="p-2 text-xs text-white/40">Aucune playlist pour l&apos;instant.</p>
            )}
            {playlists?.map((playlist) => (
              <button
                key={playlist.id}
                type="button"
                onClick={() => ajouter(playlist.id)}
                className="block w-full truncate rounded px-2 py-1.5 text-left text-sm text-white/80 hover:bg-white/10"
              >
                {playlist.name}
              </button>
            ))}
          </div>

          <form onSubmit={creerEtAjouter} className="mt-2 flex gap-1 border-t border-faso-line pt-2">
            <input
              value={nouveau}
              onChange={(evenement) => setNouveau(evenement.target.value)}
              placeholder="Nouvelle playlist"
              aria-label="Nom de la nouvelle playlist"
              className="input !py-1 text-xs"
            />
            <button
              type="submit"
              aria-label="Creer et ajouter"
              className="shrink-0 rounded-lg bg-faso-gold px-2 text-black"
            >
              <HiPlus />
            </button>
          </form>
        </div>
      )}
    </span>
  );
}
