import Link from "next/link";
import { notFound } from "next/navigation";
import { HiCheckBadge } from "react-icons/hi2";
import { getTrack, listTracks } from "@/lib/repo/tracks";
import TrackDetailActions from "@/components/TrackDetailActions";
import TrackList from "@/components/TrackList";
import SectionHeader from "@/components/SectionHeader";
import Cover from "@/components/Cover";
import { formatCount, formatDuration, formatSize } from "@/lib/format";

export const dynamic = "force-dynamic";

export function generateMetadata({ params }) {
  const track = getTrack(params.id);
  if (!track) return { title: "Titre introuvable" };
  return {
    title: `${track.title} — ${track.artist.name}`,
    description:
      track.description || `Ecoutez ${track.title} de ${track.artist.name} sur FASO-ZIK.`,
  };
}

export default function TrackPage({ params }) {
  const track = getTrack(params.id);
  if (!track || !track.published) notFound();

  const sameArtist = listTracks({ artistId: track.artist.id, limit: 12 }).filter(
    (item) => item.id !== track.id,
  );

  const permissions = [
    ["Ecoute en ligne", track.permissions.stream],
    ["Telechargement", track.permissions.download],
    ["Usage en platine DJ", track.permissions.dj],
  ];

  return (
    <div className="flex flex-col gap-8">
      <article className="flex flex-col gap-6 rounded-2xl border border-faso-line bg-faso-panel/50 p-5 sm:flex-row sm:p-7">
        <div className="mx-auto h-52 w-52 shrink-0 overflow-hidden rounded-xl border border-faso-line sm:mx-0">
          <Cover src={track.coverUrl} alt={track.title} rounded="rounded-xl" />
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-widest text-faso-gold">
            {track.kind === "video" ? "Clip video" : "Titre"}
          </p>
          <h1 className="mt-1 text-2xl font-black text-white sm:text-3xl">{track.title}</h1>
          <Link
            href={`/artistes/${track.artist.slug}`}
            className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-white/70 hover:text-white"
          >
            {track.artist.name}
            {track.artist.verified && <HiCheckBadge className="text-faso-gold" />}
          </Link>

          <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
            {track.genre && <span className="chip">{track.genre}</span>}
            {track.language && <span className="chip">{track.language}</span>}
            {track.bpm ? <span className="chip">{Math.round(track.bpm)} BPM</span> : null}
            {track.musicKey && <span className="chip">Tonalite {track.musicKey}</span>}
            <span className="chip">{formatDuration(track.duration)}</span>
            <span className="chip">{formatSize(track.size)}</span>
            <span className="chip">{formatCount(track.plays)} ecoutes</span>
          </div>

          {track.description && (
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-white/65">{track.description}</p>
          )}

          <TrackDetailActions track={track} />

          <section className="mt-6 rounded-xl border border-faso-line bg-black/30 p-4">
            <h2 className="text-sm font-bold text-white">Autorisations de l&apos;artiste</h2>
            <p className="mt-1 text-xs text-white/40">
              Droits accordes par {track.artist.name} pour ce titre. Licence declaree :{" "}
              {track.license}.
            </p>
            <ul className="mt-3 grid gap-2 sm:grid-cols-3">
              {permissions.map(([label, allowed]) => (
                <li
                  key={label}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium ${
                    allowed
                      ? "border-faso-green/40 bg-faso-green/10 text-faso-green"
                      : "border-faso-line bg-white/5 text-white/35"
                  }`}
                >
                  <span aria-hidden="true">{allowed ? "✓" : "✕"}</span>
                  {label}
                </li>
              ))}
            </ul>
          </section>
        </div>
      </article>

      {sameArtist.length > 0 && (
        <section>
          <SectionHeader title={`Autres titres de ${track.artist.name}`} href={`/artistes/${track.artist.slug}`} />
          <TrackList tracks={sameArtist} />
        </section>
      )}
    </div>
  );
}
