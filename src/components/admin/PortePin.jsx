"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { HiLockClosed } from "react-icons/hi2";

/**
 * Porte du code d'administration.
 *
 * Le mot de passe ouvre le compte ; ce code ouvre la console. Un mot de passe
 * vole ne suffit donc pas a retirer des titres ou a lire les comptes du site.
 */
export default function PortePin() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [envoi, setEnvoi] = useState(false);

  async function ouvrir(evenement) {
    evenement.preventDefault();
    setEnvoi(true);
    try {
      const reponse = await fetch("/api/admin/pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const donnees = await reponse.json();
      if (!reponse.ok) throw new Error(donnees.error || "Code refuse.");
      router.refresh();
    } catch (erreur) {
      toast.error(erreur.message);
      setCode("");
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[55vh] max-w-sm flex-col justify-center">
      <div className="card">
        <p className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-faso-gold">
          <HiLockClosed /> Console fermee
        </p>
        <h1 className="section-title mb-2">Code d&apos;administration</h1>
        <p className="mb-4 text-sm text-white/45">
          Votre compte porte le role, mais la console demande un second code. Il n&apos;est ecrit
          nulle part dans le site.
        </p>

        <form onSubmit={ouvrir} className="flex flex-col gap-3">
          <input
            type="password"
            inputMode="numeric"
            autoComplete="off"
            value={code}
            onChange={(evenement) => setCode(evenement.target.value)}
            placeholder="Code"
            className="w-full rounded-lg border border-faso-line bg-black/40 p-3 text-center text-lg tracking-[0.4em] outline-none focus:border-faso-gold"
            aria-label="Code d'administration"
          />
          <button type="submit" disabled={envoi || !code} className="btn-primary">
            {envoi ? "Verification…" : "Ouvrir la console"}
          </button>
        </form>
      </div>
    </div>
  );
}
