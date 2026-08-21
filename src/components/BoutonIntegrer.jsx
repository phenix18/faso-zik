"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { HiCodeBracket } from "react-icons/hi2";

/** Donne le code d'insertion du lecteur dans un site exterieur. */
export default function BoutonIntegrer({ trackId }) {
  const [ouvert, setOuvert] = useState(false);

  const code = `<iframe src="${
    typeof window === "undefined" ? "" : window.location.origin
  }/embed/${trackId}" width="100%" height="112" frameborder="0" loading="lazy" title="Lecteur FASO-ZIK"></iframe>`;

  async function copier() {
    try {
      await navigator.clipboard.writeText(code);
      toast.success("Code copie.");
    } catch {
      // Le presse-papiers est refuse hors HTTPS : le code reste selectionnable.
      toast("Selectionnez le code pour le copier.");
    }
  }

  return (
    <>
      <button type="button" onClick={() => setOuvert((etat) => !etat)} className="btn-ghost">
        <HiCodeBracket className="text-lg" /> Integrer
      </button>

      {ouvert && (
        <div className="mt-3 w-full rounded-xl border border-faso-line bg-black/40 p-3">
          <p className="mb-2 text-xs text-white/50">
            Collez ce code dans une page pour y afficher le lecteur.
          </p>
          <textarea
            readOnly
            value={code}
            rows={3}
            onFocus={(evenement) => evenement.target.select()}
            className="input font-mono text-[11px]"
          />
          <button type="button" onClick={copier} className="btn-ghost mt-2 !px-3 !py-1.5">
            Copier
          </button>
        </div>
      )}
    </>
  );
}
