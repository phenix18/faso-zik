"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { HiMagnifyingGlass, HiSpeakerWave } from "react-icons/hi2";
import Deck from "@/components/dj/Deck";
import YouTubePanneau from "@/components/dj/YouTubePanneau";
import useDeck from "@/components/dj/useDeck";
import Cover from "@/components/Cover";
import { formatDuration } from "@/lib/format";

/**
 * Console DJ deux platines.
 *
 * L'AudioContext n'est cree qu'au premier clic : les navigateurs refusent tout
 * son declenche sans geste de l'utilisateur, et un contexte cree trop tot
 * reste bloque en "suspended".
 */
export default function DjConsole({ tracks }) {
  const [engine, setEngine] = useState(null);
  const [crossfader, setCrossfader] = useState(0);
  const [master, setMaster] = useState(0.85);
  const [query, setQuery] = useState("");
  const startRef = useRef(null);

  const deckA = useDeck(engine?.context, engine?.channelA, "A");
  const deckB = useDeck(engine?.context, engine?.channelB, "B");

  function start() {
    if (engine) return;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    const context = new AudioContextClass();

    const masterGain = context.createGain();
    masterGain.gain.value = master;
    masterGain.connect(context.destination);

    const channelA = context.createGain();
    const channelB = context.createGain();
    channelA.connect(masterGain);
    channelB.connect(masterGain);

    setEngine({ context, masterGain, channelA, channelB });
    context.resume();
  }

  // Courbe de puissance constante : le volume percu reste stable au milieu.
  useEffect(() => {
    if (!engine) return;
    const angle = ((crossfader + 1) / 2) * (Math.PI / 2);
    engine.channelA.gain.value = Math.cos(angle);
    engine.channelB.gain.value = Math.sin(angle);
  }, [crossfader, engine]);

  useEffect(() => {
    if (engine) engine.masterGain.gain.value = master;
  }, [master, engine]);

  // Raccourcis clavier facon controleur : Q/W pour A, O/P pour B.
  useEffect(() => {
    function onKey(event) {
      const tag = event.target?.tagName;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(tag)) return;
      const bindings = {
        KeyQ: () => deckA.cue(),
        KeyW: () => deckA.toggle(),
        KeyO: () => deckB.cue(),
        KeyP: () => deckB.toggle(),
      };
      if (bindings[event.code]) {
        event.preventDefault();
        bindings[event.code]();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [deckA, deckB]);

  useEffect(() => () => engine?.context.close(), [engine]);

  const crate = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return tracks;
    return tracks.filter((track) =>
      `${track.title} ${track.artist.name} ${track.genre || ""}`.toLowerCase().includes(needle),
    );
  }, [query, tracks]);

  /** Aligne la platine passee en argument sur le tempo de l'autre. */
  function sync(deck) {
    const other = deck.label === "A" ? deckB : deckA;
    if (!deck.baseBpm || !other.effectiveBpm) return;
    const ratio = other.effectiveBpm / deck.baseBpm;
    deck.setRate(Math.min(Math.max(ratio, 0.84), 1.16));
  }

  if (!engine) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-6 py-8">
        <div className="flex flex-col items-center gap-4 text-center">
          <h1 className="text-2xl font-black text-white">Platine DJ FASO-ZIK</h1>
          <p className="max-w-lg text-sm text-white/50">
            Deux platines, un crossfader, un egaliseur trois bandes, echo et reverberation, des
            boucles calees au tempo et un bac a disques limite aux titres que les artistes ont
            ouverts au mix. L&apos;acces est libre, sans compte.
          </p>
          <button ref={startRef} type="button" onClick={start} className="btn-primary !px-6 !py-3">
            <HiSpeakerWave className="text-lg" /> Demarrer la console
          </button>
          <p className="text-xs text-white/30">
            {tracks.length} titre(s) disponible(s) pour le mix. Le navigateur exige ce clic avant
            de laisser un site produire du son.
          </p>
        </div>

        {/* La source YouTube n'a pas besoin du moteur audio : elle reste
            accessible avant meme d'avoir demarre la console. */}
        <YouTubePanneau />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-white">Platine DJ</h1>
          <p className="text-xs text-white/40">
            Raccourcis : Q/W platine A (cue / lecture), O/P platine B.
          </p>
        </div>
      </header>

      <div className="grid gap-4 xl:grid-cols-2">
        <Deck deck={deckA} colour="#EF3340" accent="bg-faso-red text-white" onSync={sync} syncTarget={deckB.track} />
        <Deck deck={deckB} colour="#12A24A" accent="bg-faso-green text-white" onSync={sync} syncTarget={deckA.track} />
      </div>

      <section className="card flex flex-col gap-3" aria-label="Table de mixage">
        <div className="flex flex-wrap items-center gap-6">
          <div className="min-w-[220px] flex-1">
            <div className="mb-1 flex justify-between text-[11px] text-white/45">
              <span className="font-bold text-faso-red">A</span>
              <button
                type="button"
                onClick={() => setCrossfader(0)}
                className="hover:text-faso-gold"
              >
                Crossfader — centrer
              </button>
              <span className="font-bold text-faso-green">B</span>
            </div>
            <input
              type="range"
              min={-1}
              max={1}
              step={0.01}
              value={crossfader}
              onChange={(event) => setCrossfader(Number(event.target.value))}
              aria-label="Crossfader"
            />
          </div>

          <div className="w-40">
            <p className="mb-1 text-[11px] text-white/45">
              Volume general — {Math.round(master * 100)} %
            </p>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={master}
              onChange={(event) => setMaster(Number(event.target.value))}
              aria-label="Volume general"
            />
          </div>
        </div>
      </section>

      <YouTubePanneau />

      <section className="card" aria-label="Bac a disques">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <h2 className="text-sm font-bold text-white">Bac a disques</h2>
          <span className="chip">{crate.length} titre(s)</span>
          <div className="relative ml-auto w-full max-w-xs">
            <HiMagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/35" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Filtrer le bac"
              aria-label="Filtrer le bac a disques"
              className="input pl-9"
            />
          </div>
        </div>

        {crate.length === 0 ? (
          <p className="rounded-lg border border-dashed border-faso-line p-6 text-sm text-white/40">
            Aucun titre ouvert au mix pour l&apos;instant. Les artistes activent ce droit depuis
            leur studio, morceau par morceau.
          </p>
        ) : (
          <div className="max-h-80 overflow-y-auto pr-1">
            {crate.map((track) => (
              <div
                key={track.id}
                className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-white/5"
              >
                <span className="h-10 w-10 shrink-0 overflow-hidden rounded">
                  <Cover src={track.coverUrl} alt={track.title} rounded="rounded" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-white">{track.title}</p>
                  <Link
                    href={`/artistes/${track.artist.slug}`}
                    className="truncate text-xs text-white/45 hover:text-white"
                  >
                    {track.artist.name}
                  </Link>
                </div>
                <span className="hidden text-xs text-white/35 sm:block">
                  {track.bpm ? `${Math.round(track.bpm)} BPM` : "BPM ?"}
                </span>
                <span className="text-xs text-white/35">{formatDuration(track.duration)}</span>
                <button
                  type="button"
                  onClick={() => deckA.load(track)}
                  className="btn-ghost !px-3 !py-1.5 !text-faso-red"
                >
                  → A
                </button>
                <button
                  type="button"
                  onClick={() => deckB.load(track)}
                  className="btn-ghost !px-3 !py-1.5 !text-faso-green"
                >
                  → B
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
