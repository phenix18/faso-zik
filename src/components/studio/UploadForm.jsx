"use client";

import { useRef, useState } from "react";
import toast from "react-hot-toast";
import { HiCloudArrowUp } from "react-icons/hi2";
import { dureeVideo, envoyerFichier, preparerAudio } from "@/lib/navigateur/encodage";
import { formatSize } from "@/lib/format";

const ETAPES = {
  decodage: "Lecture du fichier",
  analyse: "Mesure du tempo",
  encodage: "Fabrication de la version d'ecoute",
  envoi: "Envoi vers le stockage",
  enregistrement: "Enregistrement du titre",
};

/**
 * Depot d'un titre ou d'un clip.
 *
 * Le fichier ne passe pas par l'application : le navigateur prepare la version
 * d'ecoute, demande des adresses d'envoi signees, depose directement au
 * stockage, puis previent le serveur. C'est ce qui permet de deposer un clip
 * de plusieurs centaines de megaoctets.
 */
export default function UploadForm({ onPublished, albums = [] }) {
  const formRef = useRef(null);
  const [media, setMedia] = useState(null);
  const [etape, setEtape] = useState(null);
  const [avancement, setAvancement] = useState(0);

  function avancer(nom, valeur) {
    setEtape(nom);
    setAvancement(Math.round(valeur * 100));
  }

  async function soumettre(evenement) {
    evenement.preventDefault();
    const formulaire = new FormData(formRef.current);
    const fichier = formulaire.get("media");
    const pochette = formulaire.get("cover");

    if (!fichier?.size) {
      toast.error("Choisissez un fichier audio ou video.");
      return;
    }
    if (!formRef.current.elements.rightsConfirmed.checked) {
      toast.error("Cochez la declaration de droits pour pouvoir publier.");
      return;
    }

    const kind = fichier.type.startsWith("video/") ? "video" : "audio";

    try {
      // 1. Preparation locale : duree, tempo, version d'ecoute.
      let duree = 0;
      let bpm = null;
      let ecoute = null;

      if (kind === "audio") {
        const prepare = await preparerAudio(fichier, avancer);
        duree = prepare.duree;
        bpm = prepare.bpm;
        ecoute = prepare.ecoute;
      } else {
        avancer("decodage", 0.1);
        duree = await dureeVideo(fichier);
      }

      // 2. Adresses d'envoi, une par fichier.
      avancer("envoi", 0);
      const demandes = [
        { role: "media", kind, mime: fichier.type, taille: fichier.size, nom: fichier.name },
      ];
      if (ecoute) {
        demandes.push({ role: "ecoute", kind: "audio", mime: "audio/mpeg", taille: ecoute.size });
      }
      if (pochette?.size) {
        demandes.push({
          role: "pochette",
          kind: "image",
          mime: pochette.type,
          taille: pochette.size,
          nom: pochette.name,
        });
      }

      const reponseAdresses = await fetch("/api/upload/adresse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fichiers: demandes }),
      });
      const { adresses, error } = await reponseAdresses.json();
      if (!reponseAdresses.ok) throw new Error(error);

      // 3. Envoi direct. L'original pese le plus : c'est lui qui rythme la barre.
      await envoyerFichier(adresses.media.url, fichier, (part) => avancer("envoi", part * 0.9));
      if (ecoute) await envoyerFichier(adresses.ecoute.url, ecoute);
      if (pochette?.size) await envoyerFichier(adresses.pochette.url, pochette);

      // 4. Enregistrement.
      avancer("enregistrement", 1);
      const reponse = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: formulaire.get("title"),
          kind,
          mediaPath: adresses.media.chemin,
          mediaMime: fichier.type,
          mediaSize: fichier.size,
          previewPath: adresses.ecoute?.chemin,
          previewMime: ecoute ? "audio/mpeg" : undefined,
          previewSize: ecoute?.size,
          coverPath: adresses.pochette?.chemin,
          duration: duree,
          bpm: formulaire.get("bpm") ? Number(formulaire.get("bpm")) : bpm,
          genre: formulaire.get("genre") || undefined,
          language: formulaire.get("language") || undefined,
          description: formulaire.get("description") || undefined,
          musicKey: formulaire.get("musicKey") || undefined,
          license: formulaire.get("license") || undefined,
          priceCfa: Number(formulaire.get("priceCfa")) || 0,
          albumId: formulaire.get("albumId") || undefined,
          trackNo: formulaire.get("trackNo") ? Number(formulaire.get("trackNo")) : null,
          allowDownload: formRef.current.elements.allowDownload.checked,
          allowDj: formRef.current.elements.allowDj.checked,
          published: formRef.current.elements.published.checked,
          rightsConfirmed: true,
        }),
      });
      const donnees = await reponse.json();
      if (!reponse.ok) throw new Error(donnees.error);

      toast.success(
        bpm ? `Titre publie. Tempo mesure : ${bpm} BPM.` : "Titre publie.",
      );
      onPublished?.(donnees.track);
      formRef.current.reset();
      setMedia(null);
    } catch (erreur) {
      toast.error(erreur.message || "Publication impossible.");
    } finally {
      setEtape(null);
      setAvancement(0);
    }
  }

  return (
    <form ref={formRef} onSubmit={soumettre} className="card flex max-w-3xl flex-col gap-4">
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
            onChange={(evenement) => setMedia(evenement.target.files?.[0] || null)}
            className="input file:mr-3 file:rounded file:border-0 file:bg-faso-gold file:px-3 file:py-1 file:text-xs file:font-bold file:text-black"
          />
          {media && (
            <p className="mt-1 text-[11px] text-white/40">
              {media.name} · {formatSize(media.size)} ·{" "}
              {media.type.startsWith("video/")
                ? "clip video"
                : "audio — une version d'ecoute allegee sera fabriquee ici"}
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
            <input id="bpm" name="bpm" type="number" min="30" max="300" placeholder="mesure" className="input" />
          </div>
          <div>
            <label className="label" htmlFor="musicKey">
              Tonalite
            </label>
            <input id="musicKey" name="musicKey" placeholder="Am" className="input" />
          </div>
        </div>
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

      <div>
        <label className="label" htmlFor="description">
          Description
        </label>
        <textarea id="description" name="description" rows={3} className="input" />
      </div>

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
          <input id="priceCfa" name="priceCfa" type="number" min="0" step="100" defaultValue="0" className="input" />
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
            ceux qui les detiennent, et j&apos;accepte qu&apos;il soit retire en cas de reclamation
            fondee.{" "}
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
          ].map(([nom, libelle, cocheParDefaut]) => (
            <label key={nom} className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                name={nom}
                defaultChecked={cocheParDefaut}
                className="h-4 w-4 accent-faso-gold"
              />
              <span className="text-sm text-white/75">{libelle}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {etape && (
        <div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-faso-gold transition-all"
              style={{ width: `${avancement}%` }}
            />
          </div>
          <p className="mt-1 text-xs text-white/45">
            {ETAPES[etape]} — {avancement} %
          </p>
        </div>
      )}

      <button type="submit" disabled={!!etape} className="btn-primary self-start">
        <HiCloudArrowUp className="text-lg" />
        {etape ? "En cours..." : "Publier"}
      </button>
    </form>
  );
}
