import { z } from "zod";
import { currentUser } from "@/lib/auth";
import { getArtistByUserId } from "@/lib/repo/artists";
import { albumsArtiste, creerAlbum, typeAlbumValide } from "@/lib/repo/albums";
import { fail, json } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  titre: z.string().min(1, "Donnez un titre a l'album.").max(160),
  kind: z.string().optional(),
  description: z.string().max(2000).optional(),
  releasedOn: z.string().max(10).optional(),
});

export async function GET() {
  const user = await currentUser();
  if (!user) return fail("Connexion requise.", 401);

  const artiste = await getArtistByUserId(user.id);
  if (!artiste) return json({ albums: [] });

  return json({ albums: await albumsArtiste(artiste.id) });
}

export async function POST(request) {
  const user = await currentUser();
  if (!user) return fail("Connexion requise.", 401);

  const artiste = await getArtistByUserId(user.id);
  if (!artiste) return fail("Ce compte n'est pas un compte artiste.", 403);

  let corps;
  try {
    corps = schema.parse(await request.json());
  } catch (erreur) {
    return fail(erreur.errors?.[0]?.message || "Donnees invalides.", 422);
  }

  if (corps.kind && !typeAlbumValide(corps.kind)) return fail("Type d'album inconnu.", 422);

  return json({ album: await creerAlbum({ artistId: artiste.id, ...corps }) }, 201);
}
