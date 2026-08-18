"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Une platine.
 *
 * Le morceau est decode entierement en memoire (AudioBuffer) avant d'etre
 * joue : c'est ce qui permet le scratch de position instantane, la boucle a
 * l'echantillon pres et le calcul de la forme d'onde. Un flux <audio> ne
 * donnerait aucune de ces trois choses.
 *
 * Un AudioBufferSourceNode n'est jouable qu'une fois ; chaque lecture, chaque
 * reprise et chaque saut en cree donc un nouveau, branche sur la meme chaine
 * gain -> EQ 3 bandes -> filtre -> sortie de la platine.
 */
export default function useDeck(context, destination, label) {
  const chainRef = useRef(null);
  const sourceRef = useRef(null);
  const startedAtRef = useRef(0);
  const offsetRef = useRef(0);
  const loopRef = useRef(null);

  const [track, setTrack] = useState(null);
  const [buffer, setBuffer] = useState(null);
  const [peaks, setPeaks] = useState(null);
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [rate, setRate] = useState(1);
  const [volume, setVolume] = useState(0.85);
  const [eq, setEq] = useState({ low: 0, mid: 0, high: 0 });
  const [filter, setFilter] = useState(0);
  const [cuePoint, setCuePoint] = useState(0);
  const [loop, setLoopState] = useState(null);
  const [error, setError] = useState(null);

  // Chaine audio de la platine, construite une seule fois.
  if (context && destination && !chainRef.current) {
    const low = context.createBiquadFilter();
    low.type = "lowshelf";
    low.frequency.value = 250;

    const mid = context.createBiquadFilter();
    mid.type = "peaking";
    mid.frequency.value = 1200;
    mid.Q.value = 0.8;

    const high = context.createBiquadFilter();
    high.type = "highshelf";
    high.frequency.value = 4000;

    // Filtre unique bipolaire : passe-haut a droite, passe-bas a gauche.
    const colour = context.createBiquadFilter();
    colour.type = "allpass";

    const gain = context.createGain();
    gain.gain.value = 0.85;

    const analyser = context.createAnalyser();
    analyser.fftSize = 256;

    low.connect(mid).connect(high).connect(colour).connect(gain).connect(analyser);
    analyser.connect(destination);

    chainRef.current = { low, mid, high, colour, gain, analyser, input: low };
  }

  /* ------------------------------ reglages ------------------------------ */

  useEffect(() => {
    const chain = chainRef.current;
    if (chain) chain.gain.gain.value = volume;
  }, [volume]);

  useEffect(() => {
    const chain = chainRef.current;
    if (!chain) return;
    chain.low.gain.value = eq.low;
    chain.mid.gain.value = eq.mid;
    chain.high.gain.value = eq.high;
  }, [eq]);

  useEffect(() => {
    const chain = chainRef.current;
    if (!chain) return;
    if (filter === 0) {
      chain.colour.type = "allpass";
      return;
    }
    if (filter > 0) {
      chain.colour.type = "highpass";
      chain.colour.frequency.value = 40 * Math.pow(180, filter); // 40 Hz -> 7,2 kHz
    } else {
      chain.colour.type = "lowpass";
      chain.colour.frequency.value = 22000 * Math.pow(0.005, -filter); // 22 kHz -> 110 Hz
    }
  }, [filter]);

  useEffect(() => {
    if (sourceRef.current) sourceRef.current.playbackRate.value = rate;
  }, [rate]);

  useEffect(() => {
    loopRef.current = loop;
    const source = sourceRef.current;
    if (!source) return;
    if (loop) {
      source.loopStart = loop.start;
      source.loopEnd = loop.end;
      source.loop = true;
    } else {
      source.loop = false;
    }
  }, [loop]);

  /* ------------------------------ lecture ------------------------------- */

  const stopSource = useCallback(() => {
    const source = sourceRef.current;
    if (!source) return;
    source.onended = null;
    try {
      source.stop();
    } catch {
      /* deja arrete */
    }
    source.disconnect();
    sourceRef.current = null;
  }, []);

  const startAt = useCallback(
    (offset) => {
      if (!context || !buffer || !chainRef.current) return;
      stopSource();

      const source = context.createBufferSource();
      source.buffer = buffer;
      source.playbackRate.value = rate;
      if (loopRef.current) {
        source.loopStart = loopRef.current.start;
        source.loopEnd = loopRef.current.end;
        source.loop = true;
      }
      source.connect(chainRef.current.input);
      source.onended = () => {
        if (sourceRef.current === source && !loopRef.current) {
          sourceRef.current = null;
          setPlaying(false);
        }
      };
      source.start(0, Math.min(Math.max(offset, 0), buffer.duration - 0.01));

      sourceRef.current = source;
      startedAtRef.current = context.currentTime;
      offsetRef.current = offset;
      setPlaying(true);
    },
    [buffer, context, rate, stopSource],
  );

  const currentPosition = useCallback(() => {
    if (!context || !buffer) return 0;
    if (!sourceRef.current) return offsetRef.current;
    let value = offsetRef.current + (context.currentTime - startedAtRef.current) * rate;
    const active = loopRef.current;
    if (active && value > active.end) {
      const span = active.end - active.start;
      value = active.start + ((value - active.start) % span);
    }
    return Math.min(value, buffer.duration);
  }, [buffer, context, rate]);

  // Rafraichissement de l'affichage (tete de lecture, compteur).
  useEffect(() => {
    if (!playing) return undefined;
    const id = setInterval(() => setPosition(currentPosition()), 50);
    return () => clearInterval(id);
  }, [playing, currentPosition]);

  const play = useCallback(() => {
    if (!buffer) return;
    startAt(offsetRef.current);
  }, [buffer, startAt]);

  const pause = useCallback(() => {
    if (!sourceRef.current) return;
    const value = currentPosition();
    stopSource();
    offsetRef.current = value;
    setPosition(value);
    setPlaying(false);
  }, [currentPosition, stopSource]);

  const toggle = useCallback(() => {
    if (playing) pause();
    else play();
  }, [pause, play, playing]);

  const seek = useCallback(
    (value) => {
      const clamped = Math.max(0, Math.min(value, (buffer?.duration || 0) - 0.01));
      offsetRef.current = clamped;
      setPosition(clamped);
      if (playing) startAt(clamped);
    },
    [buffer, playing, startAt],
  );

  /** Cue facon platine : pose le repere, ou y revient d'un coup. */
  const cue = useCallback(() => {
    if (playing) {
      pause();
      seek(cuePoint);
    } else if (Math.abs(currentPosition() - cuePoint) < 0.05) {
      play();
    } else {
      setCuePoint(currentPosition());
    }
  }, [currentPosition, cuePoint, pause, play, playing, seek]);

  const setLoop = useCallback(
    (beats, bpm) => {
      if (!buffer) return;
      if (!beats) {
        setLoopState(null);
        return;
      }
      const tempo = bpm || 120;
      const start = currentPosition();
      const length = (60 / tempo) * beats;
      setLoopState({ start, end: Math.min(start + length, buffer.duration) });
    },
    [buffer, currentPosition],
  );

  /* ----------------------------- chargement ----------------------------- */

  const load = useCallback(
    async (nextTrack) => {
      if (!context) return;
      setLoading(true);
      setError(null);
      stopSource();
      setPlaying(false);

      try {
        const response = await fetch(nextTrack.streamUrl);
        if (!response.ok) {
          throw new Error(
            response.status === 403
              ? "L'artiste n'autorise pas l'usage de ce titre en platine."
              : "Chargement impossible.",
          );
        }
        const decoded = await context.decodeAudioData(await response.arrayBuffer());

        setBuffer(decoded);
        setPeaks(computePeaks(decoded, 900));
        setTrack(nextTrack);
        offsetRef.current = 0;
        setPosition(0);
        setCuePoint(0);
        setLoopState(null);
      } catch (loadError) {
        setError(loadError.message || "Chargement impossible.");
      } finally {
        setLoading(false);
      }
    },
    [context, stopSource],
  );

  const eject = useCallback(() => {
    stopSource();
    setPlaying(false);
    setTrack(null);
    setBuffer(null);
    setPeaks(null);
    setLoopState(null);
    offsetRef.current = 0;
    setPosition(0);
  }, [stopSource]);

  useEffect(() => () => stopSource(), [stopSource]);

  const baseBpm = track?.bpm || null;

  return {
    label,
    track,
    buffer,
    peaks,
    loading,
    error,
    playing,
    position,
    duration: buffer?.duration || 0,
    rate,
    setRate,
    volume,
    setVolume,
    eq,
    setEq,
    filter,
    setFilter,
    cuePoint,
    loop,
    setLoop,
    baseBpm,
    effectiveBpm: baseBpm ? baseBpm * rate : null,
    analyser: chainRef.current?.analyser || null,
    load,
    eject,
    play,
    pause,
    toggle,
    seek,
    cue,
  };
}

/** Reduit le signal a N valeurs crete pour dessiner la forme d'onde. */
function computePeaks(audioBuffer, buckets) {
  const channel = audioBuffer.getChannelData(0);
  const size = Math.floor(channel.length / buckets);
  const peaks = new Float32Array(buckets);

  for (let index = 0; index < buckets; index += 1) {
    const start = index * size;
    let max = 0;
    for (let offset = 0; offset < size; offset += 16) {
      const value = Math.abs(channel[start + offset] || 0);
      if (value > max) max = value;
    }
    peaks[index] = max;
  }
  return peaks;
}
