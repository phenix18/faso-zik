"use client";

import { useRef, useState } from "react";
import toast from "react-hot-toast";
import { HiCloudArrowUp } from "react-icons/hi2";
import { formatSize } from "@/lib/format";

/**
 * Depot d'un titre ou d'un clip.
 *
 * L'envoi passe par XMLHttpRequest et non fetch : c'est le seul moyen d'avoir
 * une barre de progression fiable sur un fichier video de plusieurs centaines
 * de megaoctets.
 */
export default function UploadForm({ onPublished, albums = [] }) {
  const formRef = useRef(null);
  const [media, setMedia] = useState(null);
  const [progress, setProgress] = useState(null);

  function submit(event) {
    event.preventDefault();
    const form = new FormData(formRef.current);
    if (!form.get("media")?.size) {
      toast.error("Choisissez un fichier audio ou video.");
      return;
    }

    // Les cases non cochees ne sont pas envoyees par le navigateur : on force
    // la valeur pour que le serveur recoive un booleen explicite.
    if (!formRef.current.elements.rightsConfirmed.checked) {
      toast.error("Cochez la declaration de droits pour pouvoir publier.");
      return;
    }

    for (const field of ["allowDownload", "allowDj", "published", "rightsConfirmed"]) {
      form.set(field, formRef.current.elements[field].checked ? "true" : "false");
    }

    const request = new XMLHttpRequest();
    request.open("POST", "/api/upload");
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) setProgress(Math.round((event.loaded / event.total) * 100));
    };
    request.onload = () => {
      setProgress(null);
      let data = {};
      try {
        data = JSON.parse(request.responseText);
      } catch {
        /* reponse non JSON : message generique ci-dessous */
      }
      if (request.status >= 200 && request.status < 300) {
        toast.success("Titre publie.");
        onPublished?.(data.track);
        formRef.current.reset();
        setMedia(null);
      } else {
        toast.error(data.error || "Publication impossible.");
      }
    };
    request.onerror = () => {
      setProgress(null);
      toast.error("Envoi interrompu.");
    };
    request.send(form);
  }

  return (
    <form ref={formRef} onSubmit={submit} className="card flex max-w-3xl flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="media">
            Fichier audio ou video *
          </label>
          <input
            id="media"
            name="media"
            type="file"
            required
            accept="audio/*,video/mp4,video/webm,video/quicktime"
            onChange={(event) => setMedia(event.target.files?.[0] || null)}
            className="input file:mr-3 file:rounded file:border-0 file:bg-faso-gold file:px-3 file:py-1 file:text-xs file:font-bold file:text-black"
          />
          {media && (
            <p className="mt-1 text-[11px] text-white/40">
              {media.name} · {formatSize(media.size)} ·{" "}
              {media.type.startsWith("video/") ? "clip video" : "audio"}
            </p>
          )}
        </div>

        <div>
          <label className="label" htmlFor="cover">
            Pochette (image)
          </label>
          <input
            id="cover"
            name="cover"
            type="file"
            accept="image/*"
            className="input file:mr-3 file:rounded file:border-0 file:bg-white/10 file:px-3 file:py-1 file:text-xs file:text-white"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="title">
            Titre *
          </label>
          <input id="title" name="title" required className="input" />
        </div>
        <div>
          <label className="label" htmlFor="genre">
            Genre
          </label>
          <input id="genre" name="genre" placeholder="Afrobeat, Coupe-decale..." className="input" />
        </div>
        <div>
          <label className="label" htmlFor="language">
            Langue
          </label>
          <input id="language" name="language" placeholder="Moore, Dioula, Francais..." className="input" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="bpm">
              BPM
            </label>
            <input id="bpm" name="bpm" type="number" min="30" max="300" className="input" />
          </div>
          <div>
            <label className="label" htmlFor="musicKey">
              Tonalite
            </label>
            <input id="musicKey" name="musicKey" placeholder="Am" className="input" />
          </div>
        </div>
      </div>

      <div>
        <label className="label" htmlFor="description">
          Description
        </label>
        <textarea id="description" name="description" rows={3} className="input" />
      </div>

      {albums.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <label className="label" htmlFor="albumId">
              Ranger dans un album
            </label>
            <select id="albumId" name="albumId" className="input">
              <option value="">Titre isole</option>
              {albums.map((album) => (
                <option key={album.id} value={album.id}>
                  {album.title}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="trackNo">
              Numero de piste
            </label>
            <input id="trackNo" name="trackNo" type="number" min="1" className="input" />
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="license">
            Licence declaree
          </label>
          <input id="license" name="license" defaultValue="Tous droits reserves" className="input" />
        </div>
        <div>
          <label className="label" htmlFor="priceCfa">
            Prix du telechargement (F CFA)
          </label>
          <input
            id="priceCfa"
            name="priceCfa"
            type="number"
            min="0"
            step="100"
            defaultValue="0"
            className="input"
          />
          <p className="mt-1 text-[11px] text-white/35">
            Zero rend le telechargement gratuit, si vous l&apos;autorisez ci-dessous.
          </p>
        </div>
      </div>

      <fieldset className="rounded-lg border border-faso-red/40 bg-faso-red/5 p-4">
        <legend className="px-2 text-xs font-bold uppercase tracking-wide text-faso-red">
          Declaration de droits
        </legend>
        <label className="flex cursor-pointer items-start gap-2">
          <input
            type="checkbox"
            name="rightsConfirmed"
            required
            className="mt-0.5 h-4 w-4 shrink-0 accent-faso-red"
          />
          <span className="text-sm text-white/75">
            Je declare detenir les droits sur cet enregistrement, ou l&apos;autorisation ecrite de
            ceux qui les detiennent, et j&apos;accepte qu&apos;il soit retire en cas de
            reclamation fondee.{" "}
            <a href="/droits" target="_blank" className="text-faso-gold hover:underline">
              Lire la procedure
            </a>
          </span>
        </label>
      </fieldset>

      <fieldset className="rounded-lg border border-faso-line bg-black/30 p-4">
        <legend className="px-2 text-xs font-bold uppercase tracking-wide text-faso-gold">
          Vos autorisations
        </legend>
        <p className="mb-3 text-xs text-white/45">
          Rien n&apos;est ouvert par defaut : cochez uniquement ce que vous acceptez. Vous pourrez
          revenir sur chaque choix a tout moment depuis votre catalogue.
        </p>
        <div className="flex flex-col gap-2">
          {[
            ["published", "Mettre en ligne tout de suite", true],
            ["allowDownload", "Autoriser le telechargement du fichier", false],
            ["allowDj", "Autoriser l'usage dans la platine DJ du site", false],
          ].map(([name, label, defaultChecked]) => (
            <label key={name} className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                name={name}
                defaultChecked={defaultChecked}
                className="h-4 w-4 accent-faso-gold"
              />
              <span className="text-sm text-white/75">{label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {progress !== null && (
        <div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-faso-gold transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="mt-1 text-xs text-white/45">Envoi : {progress} %</p>
        </div>
      )}

      <button type="submit" disabled={progress !== null} className="btn-primary self-start">
        <HiCloudArrowUp className="text-lg" />
        {progress !== null ? "Envoi en cours..." : "Publier"}
      </button>
    </form>
  );
}
