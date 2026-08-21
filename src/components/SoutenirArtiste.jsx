"use client";

import { useState } from "react";
import { HiHandRaised } from "react-icons/hi2";
import PaiementForm from "@/components/PaiementForm";

/** Pourboire libre a un artiste, depuis sa page. */
export default function SoutenirArtiste({ artist }) {
  const [ouvert, setOuvert] = useState(false);

  return (
    <div className="mt-4">
      <button type="button" onClick={() => setOuvert((etat) => !etat)} className="btn-primary">
        <HiHandRaised className="text-lg" /> Soutenir l&apos;artiste
      </button>

      {ouvert && (
        <div className="mt-4 max-w-md rounded-xl border border-faso-line bg-black/40 p-4 text-left">
          <PaiementForm type="pourboire" artist={artist} onClose={() => setOuvert(false)} />
        </div>
      )}
    </div>
  );
}
