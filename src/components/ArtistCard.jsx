import Link from "next/link";
import { HiCheckBadge } from "react-icons/hi2";
import { formatCount } from "@/lib/format";

export default function ArtistCard({ artist }) {
  return (
    <Link
      href={`/artistes/${artist.slug}`}
      className="group flex flex-col items-center gap-2 rounded-xl border border-faso-line bg-faso-panel/50 p-4 text-center transition hover:border-faso-gold/40 hover:bg-faso-panel"
    >
      <span className="relative h-20 w-20 overflow-hidden rounded-full border border-faso-line">
        {artist.photo_url ? (
          <img src={artist.photo_url} alt={artist.name} className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full w-full items-center justify-center bg-gradient-to-br from-faso-red/60 to-faso-green/50 text-xl font-black text-white">
            {artist.name.slice(0, 2).toUpperCase()}
          </span>
        )}
      </span>
      <span className="flex items-center gap-1 text-sm font-semibold text-white">
        {artist.name}
        {!!artist.verified && <HiCheckBadge className="text-faso-gold" />}
      </span>
      <span className="text-[11px] text-white/40">
        {artist.city ? `${artist.city} · ` : ""}
        {artist.track_count ?? 0} titre{(artist.track_count ?? 0) > 1 ? "s" : ""}
      </span>
      {artist.total_plays > 0 && (
        <span className="text-[11px] text-white/30">{formatCount(artist.total_plays)} ecoutes</span>
      )}
    </Link>
  );
}
