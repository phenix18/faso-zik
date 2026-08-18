import { listArtists } from "@/lib/repo/artists";
import { listTracks } from "@/lib/repo/tracks";
import TrackList from "@/components/TrackList";
import ArtistCard from "@/components/ArtistCard";
import SectionHeader from "@/components/SectionHeader";

export const dynamic = "force-dynamic";
export const metadata = { title: "Recherche" };

export default function RecherchePage({ searchParams }) {
  const query = (searchParams?.q || "").trim();
  const tracks = query ? listTracks({ search: query, limit: 100 }) : [];
  const artists = query ? listArtists({ search: query, limit: 12 }) : [];

  if (!query) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-2 text-center">
        <h1 className="section-title">Rechercher sur FASO-ZIK</h1>
        <p className="max-w-md text-sm text-white/45">
          Tapez un titre, un nom d&apos;artiste, un genre ou une langue dans la barre de recherche.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <h1 className="section-title">
        Resultats pour <span className="text-faso-gold">{query}</span>
      </h1>

      {artists.length > 0 && (
        <section>
          <SectionHeader title="Artistes" />
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
            {artists.map((artist) => (
              <ArtistCard key={artist.id} artist={artist} />
            ))}
          </div>
        </section>
      )}

      <section>
        <SectionHeader title="Titres et clips" />
        <TrackList tracks={tracks} empty={`Aucun resultat pour "${query}".`} />
      </section>
    </div>
  );
}
