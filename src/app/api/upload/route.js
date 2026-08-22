import { z } from "zod";
import { currentUser } from "@/lib/auth";
import { getArtistByUserId } from "@/lib/repo/artists";
import { createTrack } from "@/lib/repo/tracks";
import { albumParId } from "@/lib/repo/albums";
import { cheminValide, nettoyerObjets } from "@/lib/storage";
import { clientKey, rateLimit, tooManyRequests } from "@/lib/rateLimit";
import { fail, json } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  title: z.string().min(1, "Le titre est obligatoire.").max(160),
  kind: z.enum(["audio", "video"]),
  mediaPath: z.string(),
  mediaMime: z.string().max(100),
  mediaSize: z.number().int().positive(),
  previewPath: z.string().optional(),
  previewMime: z.string().max(100).optional(),
  previewSize: z.number().int().positive().optional(),
  coverPath: z.string().optional(),
  duration: z.number().nonnegative().optional(),
  bpm: z.number().min(30).max(300).nullable().optional(),
  genre: z.string().max(60).optional(),
  language: z.string().max(60).optional(),
  description: z.string().max(2000).optional(),
  musicKey: z.string().max(10).optional(),
  license: z.string().max(160).optional(),
  priceCfa: z.number().int().min(0).max(500000).optional(),
  albumId: z.string().optional(),
  trackNo: z.number().int().min(1).max(999).nullable().optional(),
  allowDownload: z.boolean().optional(),
  allowDj: z.boolean().optional(),
  published: z.boolean().optional(),
  rightsConfirmed: z.boolean(),
});

/**
 * Enregistrement d'un titre, une fois les fichiers deposes.
 *
 * Les chemins recus viennent du navigateur : ils sont donc revalides ici. Un
 * chemin invente ne passe pas la forme attendue, et de toute facon aucune
 * adresse d'envoi n'aurait ete signee pour lui.
 */
export async function POST(request) {
  const limite = await rateLimit(clientKey(request, "publication"), {
    limit: 20,
    windowMs: 60 * 60 * 1000,
  });
  if (!limite.allowed) {
    return tooManyRequests(limite.retryAfter, "Trop de publications consecutives.");
  }

  const user = await currentUser();
  if (!user) return fail("Connectez-vous pour publier un titre.", 401);

  const artiste = await getArtistByUserId(user.id);
  if (!artiste) return fail("Ce compte n'est pas un compte artiste.", 403);

  let corps;
  try {
    corps = schema.parse(await request.json());
  } catch (erreur) {
    return fail(erreur.errors?.[0]?.message || "Donnees invalides.", 422);
  }

  // Sans declaration de droits, rien n'entre au catalogue : c'est la seule
  // trace que le deposant assume la paternite de ce qu'il publie.
  if (!corps.rightsConfirmed) {
    return fail(
      "Vous devez declarer detenir les droits sur cet enregistrement avant de le publier.",
      422,
    );
  }

  for (const chemin of [corps.mediaPath, corps.previewPath, corps.coverPath].filter(Boolean)) {
    if (!cheminValide(chemin)) return fail("Chemin de fichier invalide.", 422);
  }

  // Un album ne peut recevoir un titre que s'il appartient au meme artiste.
  const albumDemande = corps.albumId ? await albumParId(corps.albumId) : null;
  const album = albumDemande?.artist_id === artiste.id ? albumDemande : null;

  try {
    const track = await createTrack({
      artistId: artiste.id,
      albumId: album?.id || null,
      trackNo: album ? corps.trackNo || null : null,
      title: corps.title,
      kind: corps.kind,
      genre: corps.genre || null,
      language: corps.language || null,
      description: corps.description || null,
      duration: corps.duration || 0,
      bpm: corps.bpm ?? null,
      musicKey: corps.musicKey || null,
      coverUrl: corps.coverPath ? `/api/asset/${corps.coverPath}` : null,
      mediaPath: corps.mediaPath,
      mediaMime: corps.mediaMime,
      mediaSize: corps.mediaSize,
      previewPath: corps.previewPath || null,
      previewMime: corps.previewMime || null,
      previewSize: corps.previewSize || null,
      allowDownload: corps.allowDownload,
      allowDj: corps.allowDj,
      license: corps.license || undefined,
      priceCfa: corps.priceCfa || 0,
      published: corps.published !== false,
      rightsConfirmed: true,
    });

    return json({ track }, 201);
  } catch (erreur) {
    // Le morceau n'est pas entre : les fichiers deja deposes n'ont plus de
    // raison d'occuper le stockage.
    await nettoyerObjets([corps.mediaPath, corps.previewPath, corps.coverPath]);
    return fail(`Publication impossible : ${erreur.message}`, 500);
  }
}
