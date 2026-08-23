"use client";

import {
  HiArrowPath,
  HiBackspace,
  HiPause,
  HiPlay,
} from "react-icons/hi2";
import Waveform from "@/components/dj/Waveform";
import Spectre from "@/components/dj/Spectre";
import Cover from "@/components/Cover";
import { formatDuration } from "@/lib/format";

const LOOP_LENGTHS = [1, 2, 4, 8, 16];

export default function Deck({ deck, colour, accent, onSync, syncTarget }) {
  const { track } = deck;
  const pitchPercent = (deck.rate - 1) * 100;

  return (
    <section
      className="card flex flex-col gap-3 transition-shadow duration-300"
      // La platine en lecture se signale d'elle-meme : dans la penombre d'une
      // cabine, on doit voir laquelle sonne sans avoir a lire.
      style={
        deck.playing
          ? { boxShadow: `0 0 26px -8px ${colour}66`, borderColor: `${colour}55` }
          : undefined
      }
      aria-label={`Platine ${deck.label}`}
    >
      <header className="flex items-center gap-3">
        <span
          className={`flex h-7 w-7 items-center justify-center rounded font-black text-black ${accent}`}
        >
          {deck.label}
        </span>
        <span className="h-11 w-11 shrink-0 overflow-hidden rounded">
          <Cover src={track?.coverUrl} alt={track?.title || deck.label} rounded="rounded" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-white">
            {track ? track.title : "Platine vide"}
          </p>
          <p className="truncate text-xs text-white/45">
            {track ? track.artist.name : "Chargez un titre depuis le bac a disques"}
          </p>
        </div>
        {track && (
          <button
            type="button"
            onClick={deck.eject}
            aria-label={`Vider la platine ${deck.label}`}
            className="p-2 text-white/35 hover:text-faso-red"
          >
            <HiBackspace />
          </button>
        )}
      </header>

      {deck.error && (
        <p className="rounded border border-faso-red/40 bg-faso-red/10 px-3 py-2 text-xs text-faso-red">
          {deck.error}
        </p>
      )}

      <Waveform
        peaks={deck.peaks}
        position={deck.position}
        duration={deck.duration}
        loop={deck.loop}
        cuePoint={deck.cuePoint}
        colour={colour}
        onSeek={deck.seek}
      />

      <Spectre analyser={deck.analyser} actif={deck.playing} teinte={colour} />

      <div className="flex items-center justify-between text-xs tabular-nums text-white/50">
        <span>{formatDuration(deck.position)}</span>
        <span className="text-white/30">
          {deck.loading ? "Decodage du morceau..." : `-${formatDuration(Math.max(deck.duration - deck.position, 0))}`}
        </span>
        <span>{formatDuration(deck.duration)}</span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={deck.toggle}
          disabled={!track}
          aria-label={deck.playing ? "Pause" : "Lecture"}
          className="btn-primary !px-5 !py-2.5 text-lg"
        >
          {deck.playing ? <HiPause /> : <HiPlay />}
        </button>
        <button
          type="button"
          onClick={deck.cue}
          disabled={!track}
          title="Poser le repere, ou y revenir"
          className="btn-ghost !px-4 !py-2.5 font-black"
        >
          CUE
        </button>
        <button
          type="button"
          onClick={() => onSync(deck)}
          disabled={!deck.baseBpm || !syncTarget}
          title="Aligner le tempo sur l'autre platine"
          className="btn-ghost !px-3 !py-2.5"
        >
          <HiArrowPath /> SYNC
        </button>

        <div className="ml-auto text-right">
          <p className="text-lg font-black leading-none text-faso-gold">
            {deck.effectiveBpm ? deck.effectiveBpm.toFixed(1) : "--"}
            <span className="ml-1 text-[10px] font-semibold text-white/40">BPM</span>
          </p>
          <p className="text-[10px] text-white/35">
            {deck.baseBpm ? `origine ${deck.baseBpm.toFixed(0)}` : "BPM non renseigne"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-[1fr_auto] gap-4">
        <div className="flex flex-col gap-3">
          <div>
            <div className="mb-1 flex items-center justify-between text-[11px] text-white/45">
              <span>Pitch / tempo</span>
              <button
                type="button"
                onClick={() => deck.setRate(1)}
                className="text-faso-gold hover:underline"
              >
                {pitchPercent > 0 ? "+" : ""}
                {pitchPercent.toFixed(1)} % — remettre a zero
              </button>
            </div>
            <input
              type="range"
              min={0.84}
              max={1.16}
              step={0.001}
              value={deck.rate}
              onChange={(event) => deck.setRate(Number(event.target.value))}
              aria-label={`Tempo platine ${deck.label}`}
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            {[
              ["high", "Aigus"],
              ["mid", "Mediums"],
              ["low", "Graves"],
            ].map(([band, label]) => (
              <div key={band}>
                <p className="mb-1 text-[11px] text-white/45">{label}</p>
                <input
                  type="range"
                  min={-26}
                  max={12}
                  step={0.5}
                  value={deck.eq[band]}
                  onChange={(event) =>
                    deck.setEq({ ...deck.eq, [band]: Number(event.target.value) })
                  }
                  aria-label={`${label} platine ${deck.label}`}
                />
              </div>
            ))}
          </div>

          <div>
            <p className="mb-1 text-[11px] text-white/45">
              Filtre {deck.filter === 0 ? "neutre" : deck.filter > 0 ? "passe-haut" : "passe-bas"}
            </p>
            <input
              type="range"
              min={-1}
              max={1}
              step={0.01}
              value={deck.filter}
              onChange={(event) => deck.setFilter(Number(event.target.value))}
              onDoubleClick={() => deck.setFilter(0)}
              aria-label={`Filtre platine ${deck.label}`}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            {[
              ["Echo", deck.echoMix, deck.setEchoMix, "l'echo se cale sur le tempo joue"],
              ["Reverb", deck.reverbMix, deck.setReverbMix, "profondeur de salle"],
            ].map(([label, valeur, poser, aide]) => (
              <div key={label}>
                <p className="mb-1 flex items-baseline justify-between text-[11px] text-white/45">
                  <span className={valeur > 0.02 ? "font-semibold text-faso-gold" : ""}>{label}</span>
                  <span className="tabular-nums">{Math.round(valeur * 100)}%</span>
                </p>
                <input
                  type="range"
                  min={0}
                  max={0.9}
                  step={0.01}
                  value={valeur}
                  onChange={(event) => poser(Number(event.target.value))}
                  onDoubleClick={() => poser(0)}
                  title={aide}
                  aria-label={`${label} platine ${deck.label}`}
                />
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-white/45">Boucle</span>
            {LOOP_LENGTHS.map((beats) => (
              <button
                key={beats}
                type="button"
                disabled={!track}
                onClick={() => deck.setLoop(beats, deck.effectiveBpm || 120)}
                className="chip hover:border-faso-gold/60 hover:text-faso-gold"
              >
                {beats}
              </button>
            ))}
            <button
              type="button"
              disabled={!deck.loop}
              onClick={() => deck.setLoop(null)}
              className={`chip ${deck.loop ? "border-faso-gold/70 text-faso-gold" : ""}`}
            >
              Sortir
            </button>
          </div>
        </div>

        <div className="flex flex-col items-center gap-2">
          <span className="text-[11px] text-white/45">Vol</span>
          <input
            type="range"
            className="vertical"
            min={0}
            max={1}
            step={0.01}
            value={deck.volume}
            onChange={(event) => deck.setVolume(Number(event.target.value))}
            aria-label={`Volume platine ${deck.label}`}
          />
          <span className="text-[11px] tabular-nums text-white/35">
            {Math.round(deck.volume * 100)}
          </span>
        </div>
      </div>
    </section>
  );
}
