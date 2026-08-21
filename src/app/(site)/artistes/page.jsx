import { listArtists } from "@/lib/repo/artists";
import ArtistCard from "@/components/ArtistCard";

export const dynamic = "force-dynamic";
export const metadata = { title: "Artistes" };

export default function ArtistesPage({ searchParams }) {
  const artists = listArtists({ search: searchParams?.q || "", limit: 200 });

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="section-title">Artistes</h1>
        <p className="text-xs text-white/40">{artists.length} artiste(s) sur FASO-ZIK</p>
      </div>

      {artists.length ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
          {artists.map((artist) => (
            <ArtistCard key={artist.id} artist={artist} />
          ))}
        </div>
      ) : (
        <p className="rounded-lg border border-dashed border-faso-line p-6 text-sm text-white/40">
          Aucun artiste inscrit pour le moment.
        </p>
      )}
    </div>
  );
}
