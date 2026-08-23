"use client";

import { useEffect, useRef, useState } from "react";
import { HiPlay, HiPause, HiXMark } from "react-icons/hi2";
import { identifiantYouTube } from "@/lib/youtube";

/**
 * Source YouTube, a cote des deux platines.
 *
 * Ce que cela fait : une troisieme source d'ambiance — un instrumental, une
 * ambiance de foule, un morceau qui n'est pas au catalogue — dont on regle le
 * volume a la main pour la fondre avec le mix.
 *
 * Ce que cela ne fait pas, et pourquoi : le son n'entre pas dans la chaine
 * audio des platines. Il vient d'un cadre d'un autre domaine, que le navigateur
 * isole ; ni l'egaliseur, ni le filtre, ni le crossfader ne peuvent l'atteindre.
 * Autrement dit, on peut le monter et le descendre, pas le travailler. Mieux
 * vaut le dire que laisser croire le contraire.
 *
 * Le lecteur officiel est utilise tel quel : c'est ce que les conditions de
 * YouTube autorisent. Recuperer la piste audio pour la passer dans les platines
 * ne serait ni possible depuis un navigateur, ni permis.
 */

export default function YouTubePanneau() {
  const [saisie, setSaisie] = useState("");
  const [video, setVideo] = useState(null);
  const [erreur, setErreur] = useState(null);
  const [volume, setVolume] = useState(0.7);
  const [enLecture, setEnLecture] = useState(false);
  const lecteurRef = useRef(null);
  const cadreRef = useRef(null);

  // L'API du cadre YouTube se pilote par messages : le lecteur vit dans un
  // autre domaine, aucun appel direct n'est possible.
  function commander(fonction, args = []) {
    const cadre = cadreRef.current;
    if (!cadre?.contentWindow) return;
    cadre.contentWindow.postMessage(
      JSON.stringify({ event: "command", func: fonction, args }),
      "https://www.youtube-nocookie.com",
    );
  }

  useEffect(() => {
    if (video) commander("setVolume", [Math.round(volume * 100)]);
  }, [volume, video]);

  function charger(evenement) {
    evenement.preventDefault();
    const identifiant = identifiantYouTube(saisie);
    if (!identifiant) {
      setErreur("Adresse YouTube non reconnue.");
      return;
    }
    setErreur(null);
    setVideo(identifiant);
    setEnLecture(false);
  }

  return (
    <section className="card flex flex-col gap-3" aria-label="Source YouTube">
      <header className="flex items-center justify-between">
        <h2 className="text-sm font-bold">Source YouTube</h2>
        {video && (
          <button
            type="button"
            onClick={() => {
              setVideo(null);
              setEnLecture(false);
            }}
            className="rounded p-1 text-white/40 hover:text-white"
            aria-label="Retirer la video"
          >
            <HiXMark />
          </button>
        )}
      </header>

      <form onSubmit={charger} className="flex gap-2">
        <input
          type="text"
          value={saisie}
          onChange={(evenement) => setSaisie(evenement.target.value)}
          placeholder="Collez un lien YouTube"
          className="min-w-0 flex-1 rounded-lg border border-faso-line bg-black/40 px-3 py-2 text-sm outline-none focus:border-faso-gold"
          aria-label="Lien YouTube"
        />
        <button type="submit" className="btn-ghost shrink-0">
          Charger
        </button>
      </form>

      {erreur && <p className="text-xs text-faso-red">{erreur}</p>}

      {video ? (
        <>
          <div className="aspect-video w-full overflow-hidden rounded-lg bg-black">
            <iframe
              ref={cadreRef}
              title="Lecteur YouTube"
              src={`https://www.youtube-nocookie.com/embed/${video}?enablejsapi=1&rel=0&modestbranding=1`}
              allow="autoplay; encrypted-media"
              className="h-full w-full"
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                commander(enLecture ? "pauseVideo" : "playVideo");
                setEnLecture(!enLecture);
              }}
              className="btn-primary !px-3"
              aria-label={enLecture ? "Pause" : "Lecture"}
            >
              {enLecture ? <HiPause /> : <HiPlay />}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={volume}
              onChange={(evenement) => setVolume(Number(evenement.target.value))}
              className="flex-1"
              aria-label="Volume de la source YouTube"
            />
            <span className="w-10 shrink-0 text-right text-xs tabular-nums text-white/45">
              {Math.round(volume * 100)}%
            </span>
          </div>
        </>
      ) : (
        <p className="text-xs leading-relaxed text-white/40">
          Une troisieme source pour l&apos;ambiance : instrumental, foule, morceau hors catalogue.
          Son volume se regle a la main pour se fondre au mix — mais l&apos;egaliseur, le filtre et
          le crossfader ne l&apos;atteignent pas. Le navigateur isole le lecteur de YouTube, qui
          reste sur son domaine.
        </p>
      )}
    </section>
  );
}
