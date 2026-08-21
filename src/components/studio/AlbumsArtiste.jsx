"use client";

import { useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { HiPlus, HiTrash } from "react-icons/hi2";
import Cover from "@/components/Cover";
import { formatDuration } from "@/lib/format";

const TYPES = [
  ["album", "Album"],
  ["ep", "EP / Maxi"],
  ["single", "Single"],
  ["compilation", "Compilation"],
];

/**
 * Albums de l'artiste : creation, rangement des titres, retrait.
 *
 * Un titre retire d'un album n'est pas supprime : il redevient un titre isole,
 * visible sur la page de l'artiste.
 */
export default function AlbumsArtiste({ artiste, albumsInitiaux, titres }) {
  const [albums, setAlbums] = useState(albumsInitiaux);
  const [catalogue, setCatalogue] = useState(titres);
  const [creation, setCreation] = useState(false);

  async function appeler(url, methode, corps) {
    const reponse = await fetch(url, {
      method: methode,
      headers: { "Content-Type": "application/json" },
      body: corps ? JSON.stringify(corps) : undefined,
    });
    const donnees = await reponse.json();
    if (!reponse.ok) throw new Error(donnees.error);
    return donnees;
  }

  async function creer(evenement) {
    evenement.preventDefault();
    const formulaire = new FormData(evenement.currentTarget);
    setCreation(true);

    try {
      const { album } = await appeler("/api/albums", "POST", {
        titre: formulaire.get("titre"),
        kind: formulaire.get("kind"),
        releasedOn: formulaire.get("releasedOn") || undefined,
        description: formulaire.get("description") || undefined,
      });
      setAlbums((liste) => [album, ...liste]);
      evenement.target.reset();
      toast.success("Album cree.");
    } catch (erreur) {
      toast.error(erreur.message || "Creation impossible.");
    } finally {
      setCreation(false);
    }
  }

  async function ranger(albumId, trackId, detacher = false) {
    try {
      await appeler(`/api/albums/${albumId}`, "POST", { trackId, detacher });
      setCatalogue((liste) =>
        liste.map((titre) =>
          titre.id === trackId
            ? { ...titre, album: detacher ? null : { id: albumId, title: "" } }
            : titre,
        ),
      );
      setAlbums((liste) =>
        liste.map((album) =>
          album.id === albumId
            ? { ...album, titres: album.titres + (detacher ? -1 : 1) }
            : album,
        ),
      );
      toast.success(detacher ? "Titre retire de l'album." : "Titre range dans l'album.");
    } catch (erreur) {
      toast.error(erreur.message || "Operation impossible.");
    }
  }

  async function supprimer(albumId) {
    if (!window.confirm("Supprimer cet album ? Les titres seront conserves.")) return;

    try {
      await appeler(`/api/albums/${albumId}`, "DELETE");
      setAlbums((liste) => liste.filter((album) => album.id !== albumId));
      setCatalogue((liste) =>
        liste.map((titre) => (titre.album?.id === albumId ? { ...titre, album: null } : titre)),
      );
      toast.success("Album supprime, titres conserves.");
    } catch (erreur) {
      toast.error(erreur.message || "Suppression impossible.");
    }
  }

  const libres = catalogue.filter((titre) => !titre.album);

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={creer} className="card flex flex-col gap-3">
        <h2 className="text-sm font-bold text-white">Nouvel album</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <label className="label" htmlFor="titre">
              Titre *
            </label>
            <input id="titre" name="titre" required className="input" />
          </div>
          <div>
            <label className="label" htmlFor="kind">
              Type
            </label>
            <select id="kind" name="kind" className="input">
              {TYPES.map(([code, nom]) => (
                <option key={code} value={code}>
                  {nom}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="label" htmlFor="releasedOn">
              Date de sortie
            </label>
            <input id="releasedOn" name="releasedOn" type="date" className="input" />
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="description">
              Presentation
            </label>
            <input id="description" name="description" className="input" />
          </div>
        </div>
        <button type="submit" disabled={creation} className="btn-primary self-start">
          <HiPlus /> Creer l&apos;album
        </button>
      </form>

      {albums.length === 0 ? (
        <p className="rounded-lg border border-dashed border-faso-line p-6 text-sm text-white/40">
          Aucun album. Vos titres restent visibles un par un sur votre page.
        </p>
      ) : (
        albums.map((album) => {
          const dedans = catalogue.filter((titre) => titre.album?.id === album.id);

          return (
            <section key={album.id} className="card flex flex-col gap-3">
              <header className="flex items-center gap-3">
                <span className="h-12 w-12 shrink-0 overflow-hidden rounded">
                  <Cover src={album.cover_url} alt={album.title} rounded="rounded" />
                </span>
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/artistes/${artiste.slug}/${album.slug}`}
                    className="block truncate text-sm font-bold text-white hover:text-faso-gold"
                  >
                    {album.title}
                  </Link>
                  <p className="text-[11px] text-white/40">
                    {dedans.length} titre(s)
                    {album.duree ? ` · ${formatDuration(album.duree)}` : ""}
                    {album.released_on ? ` · ${album.released_on}` : ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => supprimer(album.id)}
                  aria-label={`Supprimer ${album.title}`}
                  className="p-2 text-white/30 hover:text-faso-red"
                >
                  <HiTrash />
                </button>
              </header>

              {dedans.length > 0 && (
                <ol className="flex flex-col gap-1">
                  {dedans.map((titre, rang) => (
                    <li
                      key={titre.id}
                      className="flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-white/5"
                    >
                      <span className="w-5 text-xs text-white/30">{rang + 1}</span>
                      <span className="min-w-0 flex-1 truncate text-white/80">{titre.title}</span>
                      <button
                        type="button"
                        onClick={() => ranger(album.id, titre.id, true)}
                        className="text-xs text-white/40 hover:text-faso-red"
                      >
                        Retirer
                      </button>
                    </li>
                  ))}
                </ol>
              )}

              {libres.length > 0 && (
                <label className="flex flex-wrap items-center gap-2 text-xs text-white/45">
                  Ajouter un titre
                  <select
                    value=""
                    onChange={(evenement) =>
                      evenement.target.value && ranger(album.id, evenement.target.value)
                    }
                    aria-label={`Ajouter un titre a ${album.title}`}
                    className="input max-w-xs !py-1 text-xs"
                  >
                    <option value="">Choisir...</option>
                    {libres.map((titre) => (
                      <option key={titre.id} value={titre.id}>
                        {titre.title}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </section>
          );
        })
      )}
    </div>
  );
}
