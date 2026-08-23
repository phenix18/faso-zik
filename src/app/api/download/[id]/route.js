import { currentUser } from "@/lib/auth";
import { getTrackRow, recordEvent } from "@/lib/repo/tracks";
import { canDownload, estPayant, peutTelecharger } from "@/lib/permissions";
import { aAchete } from "@/lib/repo/payments";
import { adresseDeLecture, extensionFor } from "@/lib/storage";
import { fail } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Nom de fichier propose : sans caractere de controle, ni guillemet. */
function nomDeFichier(row) {
  const brut = `${row.artist_name} - ${row.title}${extensionFor(row.media_mime)}`;
  return (
    brut
      .replace(/[\u0000-\u001f\u007f]/g, " ")
      .replace(/["\\/]/g, "")
      .trim()
      .slice(0, 150) || "faso-zik"
  );
}

/**
 * Telechargement : autorise uniquement si l'artiste a ouvert le droit, et si
 * le titre a ete paye lorsqu'il est en vente. Le refus vient du serveur, pas
 * d'un bouton masque.
 */
export async function GET(_request, { params }) {
  const row = await getTrackRow(params.id);
  if (!row) return fail("Morceau introuvable.", 404);
  if (!canDownload(row)) {
    return fail("L'artiste n'autorise pas le telechargement de ce titre.", 403);
  }

  // L'ecoute est libre, le telechargement non : un fichier qui quitte le site
  // suit son propre chemin ensuite. L'artiste doit au moins savoir a qui il
  // l'a confie, et un compte est ce qui rend un retrait ou un litige tracable.
  const user = await currentUser();
  if (!user) {
    return fail("Creez un compte ou connectez-vous pour telecharger ce titre.", 401);
  }

  if (estPayant(row)) {
    const paye = await aAchete(user?.id, row.id);
    if (!peutTelecharger(row, { user, dejaPaye: paye })) {
      return fail(
        `Ce titre est vendu ${row.price_cfa} F CFA par l'artiste. Reglez-le pour le telecharger.`,
        402,
      );
    }
  }

  let adresse;
  try {
    // L'original, jamais la version allegee : c'est ce que l'artiste a depose.
    adresse = await adresseDeLecture(row.media_path, { telechargement: nomDeFichier(row) });
  } catch {
    return fail("Fichier media absent du stockage.", 410);
  }

  await recordEvent(row.id, "download", user?.id || null);
  return Response.redirect(adresse, 307);
}
