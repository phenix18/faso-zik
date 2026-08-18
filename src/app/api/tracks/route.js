import { listGenres, listTracks } from "@/lib/repo/tracks";
import { json } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  const p = new URL(request.url).searchParams;
  const tracks = listTracks({
    kind: p.get("kind") || undefined,
    artistSlug: p.get("artiste") || undefined,
    genre: p.get("genre") || undefined,
    search: p.get("q") || "",
    sort: p.get("tri") || "recent",
    limit: Math.min(Number(p.get("limit") || 60), 200),
    offset: Number(p.get("offset") || 0),
  });
  return json({ tracks, genres: p.get("genres") ? listGenres() : undefined });
}
