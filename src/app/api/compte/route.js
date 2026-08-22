import { z } from "zod";
import { currentUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { changerNom, findUserById, publicUser, supprimerCompte } from "@/lib/repo/users";
import { changerMotDePasse } from "@/lib/repo/passwords";
import { getArtistByUserId } from "@/lib/repo/artists";
import { listTracks } from "@/lib/repo/tracks";
import { cheminDepuisAdresse, nettoyerObjets } from "@/lib/storage";
import { fail, json } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await currentUser();
  if (!user) return fail("Connexion requise.", 401);

  const compte = await findUserById(user.id);
  const artiste = await getArtistByUserId(user.id);
  const titres = artiste ? await listTracks({ artistId: artiste.id, includeUnpublished: true }) : [];

  return json({
    compte: publicUser(compte),
    artiste: artiste ? { nom: artiste.name, slug: artiste.slug } : null,
    titres: titres.length,
  });
}

const patchSchema = z.object({
  name: z.string().min(2).max(80).optional(),
  ancienMotDePasse: z.string().optional(),
  nouveauMotDePasse: z.string().min(8, "Le mot de passe doit contenir au moins 8 caracteres.").optional(),
});

export async function PATCH(request) {
  const user = await currentUser();
  if (!user) return fail("Connexion requise.", 401);

  let corps;
  try {
    corps = patchSchema.parse(await request.json());
  } catch (erreur) {
    return fail(erreur.errors?.[0]?.message || "Donnees invalides.", 422);
  }

  if (corps.nouveauMotDePasse) {
    // L'ancien mot de passe est exige : sans lui, une session volee suffirait
    // a verrouiller definitivement le compte de son proprietaire.
    const resultat = await changerMotDePasse(
      user.id,
      corps.ancienMotDePasse || "",
      corps.nouveauMotDePasse,
    );
    if (!resultat.ok) return fail(resultat.raison, 403);
  }

  if (corps.name) {
    await changerNom(user.id, corps.name);
  }

  return json({ compte: publicUser(await findUserById(user.id)) });
}

/**
 * Suppression du compte.
 *
 * Les enregistrements partent avec lui : les cles etrangeres s'en chargent en
 * base, les fichiers doivent etre retires du stockage a la main, sinon celui-ci
 * se remplit de medias que plus rien ne reference. Les chemins sont releves
 * avant la suppression, la cascade les emportant avec les lignes.
 */
export async function DELETE(request) {
  const user = await currentUser();
  if (!user) return fail("Connexion requise.", 401);

  const { confirmation } = await request.json().catch(() => ({}));
  if (confirmation !== "SUPPRIMER") {
    return fail("Confirmation manquante : envoyez le mot SUPPRIMER.", 422);
  }

  const artiste = await getArtistByUserId(user.id);
  const titres = artiste
    ? await query("SELECT media_path, preview_path, cover_url FROM tracks WHERE artist_id = $1", [
        artiste.id,
      ])
    : [];

  await supprimerCompte(user.id);

  const chemins = [];
  for (const ligne of titres) {
    chemins.push(ligne.media_path, ligne.preview_path, cheminDepuisAdresse(ligne.cover_url));
  }
  await nettoyerObjets(chemins);

  return json({ ok: true, titresSupprimes: titres.length });
}
