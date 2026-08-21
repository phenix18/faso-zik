import { notFound } from "next/navigation";
import { getTrack } from "@/lib/repo/tracks";
import LecteurIntegre from "@/components/LecteurIntegre";

export const dynamic = "force-dynamic";

export function generateMetadata({ params }) {
  const titre = getTrack(params.id);
  return {
    title: titre ? `${titre.title} — ${titre.artist.name}` : "Titre introuvable",
    robots: { index: false },
  };
}

/**
 * Lecteur destine a etre place dans une page exterieure.
 *
 * Il ne rend ni barre laterale ni lecteur global : la mise en page racine les
 * ajouterait, d'ou une page volontairement autonome.
 */
export default function EmbedPage({ params }) {
  const titre = getTrack(params.id);
  if (!titre || !titre.published) notFound();

  return <LecteurIntegre track={titre} />;
}
