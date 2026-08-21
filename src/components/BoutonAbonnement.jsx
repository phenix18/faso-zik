"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import toast from "react-hot-toast";
import { HiBell, HiBellAlert } from "react-icons/hi2";

/** Abonnement a un artiste : ses sorties apparaissent dans « Nouveautes ». */
export default function BoutonAbonnement({ artistId, initial = false, abonnes = 0 }) {
  const { status } = useSession();
  const [suit, setSuit] = useState(initial);
  const [nombre, setNombre] = useState(abonnes);
  const [envoi, setEnvoi] = useState(false);

  async function basculer() {
    if (status !== "authenticated") {
      toast("Connectez-vous pour suivre cet artiste.");
      return;
    }

    setEnvoi(true);
    try {
      const reponse = await fetch("/api/follows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ artistId }),
      });
      const donnees = await reponse.json();
      if (!reponse.ok) throw new Error(donnees.error);

      setSuit(donnees.suit);
      setNombre((valeur) => valeur + (donnees.suit ? 1 : -1));
    } catch (erreur) {
      toast.error(erreur.message || "Abonnement impossible.");
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <button
      type="button"
      onClick={basculer}
      disabled={envoi}
      aria-pressed={suit}
      className={suit ? "btn-ghost !border-faso-gold/50 !text-faso-gold" : "btn-ghost"}
    >
      {suit ? <HiBellAlert className="text-lg" /> : <HiBell className="text-lg" />}
      {suit ? "Abonne" : "Suivre"}
      {nombre > 0 && <span className="text-white/40">· {nombre}</span>}
    </button>
  );
}
