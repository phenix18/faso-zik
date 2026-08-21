import { z } from "zod";
import { currentUser } from "@/lib/auth";
import { artistStats, getArtistByUserId, updateArtist } from "@/lib/repo/artists";
import { promoteToArtist } from "@/lib/repo/users";
import { listTracks } from "@/lib/repo/tracks";
import { paiementsArtiste, revenusArtiste } from "@/lib/repo/payments";
import { fail, json } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Tableau de bord de l'artiste connecte : fiche, catalogue complet, chiffres. */
export async function GET() {
  const user = await currentUser();
  if (!user) return fail("Connexion requise.", 401);

  const artist = getArtistByUserId(user.id);
  if (!artist) return json({ artist: null, tracks: [], stats: null });

  return json({
    artist,
    tracks: listTracks({ artistId: artist.id, includeUnpublished: true, limit: 200 }),
    stats: artistStats(artist.id),
    revenus: revenusArtiste(artist.id),
    paiements: paiementsArtiste(artist.id, 30),
  });
}

/** Ouverture d'un espace artiste pour un compte auditeur. */
export async function POST(request) {
  const user = await currentUser();
  if (!user) return fail("Connexion requise.", 401);

  const body = await request.json().catch(() => ({}));
  const artist = promoteToArtist(user.id, body);
  return json({ artist }, 201);
}

const patchSchema = z.object({
  name: z.string().min(2).max(80).optional(),
  bio: z.string().max(2000).optional(),
  city: z.string().max(80).optional(),
  country: z.string().max(80).optional(),
  genres: z.string().max(200).optional(),
});

export async function PATCH(request) {
  const user = await currentUser();
  if (!user) return fail("Connexion requise.", 401);

  const artist = getArtistByUserId(user.id);
  if (!artist) return fail("Aucune fiche artiste sur ce compte.", 403);

  let fields;
  try {
    fields = patchSchema.parse(await request.json());
  } catch (error) {
    return fail(error.errors?.[0]?.message || "Donnees invalides.", 422);
  }

  return json({ artist: updateArtist(artist.id, fields) });
}
