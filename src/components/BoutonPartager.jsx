"use client";

import toast from "react-hot-toast";
import { HiShare } from "react-icons/hi2";

/**
 * Partage d'une page.
 *
 * Sur telephone, le menu natif du systeme ouvre WhatsApp et les autres
 * applications installees — c'est par la que la musique circule. Ailleurs, le
 * lien passe par le presse-papiers.
 */
export default function BoutonPartager({ titre, texte, className = "" }) {
  async function partager() {
    const lien = window.location.href;

    if (navigator.share) {
      try {
        await navigator.share({ title: titre, text: texte, url: lien });
        return;
      } catch (erreur) {
        // Un partage annule par l'utilisateur n'est pas une erreur a signaler.
        if (erreur.name === "AbortError") return;
      }
    }

    try {
      await navigator.clipboard.writeText(lien);
      toast.success("Lien copie.");
    } catch {
      toast("Copiez le lien depuis la barre d'adresse.");
    }
  }

  return (
    <button type="button" onClick={partager} className={`btn-ghost ${className}`}>
      <HiShare className="text-lg" /> Partager
    </button>
  );
}
