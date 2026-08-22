import { adresseDeLecture, cheminValide } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Sert les pochettes et photos d'artistes (images uniquement). */
export async function GET(_request, { params }) {
  const chemin = params.path.join("/");
  if (!chemin.startsWith("image/") || !cheminValide(chemin)) {
    return new Response("Ressource non disponible.", { status: 404 });
  }

  try {
    return Response.redirect(await adresseDeLecture(chemin), 307);
  } catch {
    return new Response("Image introuvable.", { status: 404 });
  }
}
