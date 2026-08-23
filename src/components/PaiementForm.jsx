"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import toast from "react-hot-toast";
import { HiDevicePhoneMobile } from "react-icons/hi2";
import { formatCfa } from "@/lib/format";

const OPERATEURS = [
  { code: "orange", nom: "Orange Money" },
  { code: "moov", nom: "Moov Money" },
  { code: "wave", nom: "Wave" },
];

const POURBOIRES = [500, 1000, 2000, 5000];

/**
 * Formulaire de paiement mobile money, pour l'achat d'un titre comme pour le
 * soutien a un artiste. Le montant d'un achat vient du serveur : le champ
 * n'apparait que pour un pourboire.
 */
export default function PaiementForm({ type, track, artist, onClose }) {
  const router = useRouter();
  const { status } = useSession();
  const [operateur, setOperateur] = useState("orange");
  const [numero, setNumero] = useState("");
  const [montant, setMontant] = useState(1000);
  const [envoi, setEnvoi] = useState(false);

  const estAchat = type === "achat";
  const somme = estAchat ? track.priceCfa : montant;

  async function payer(evenement) {
    evenement.preventDefault();
    if (status !== "authenticated") {
      toast("Connectez-vous pour payer.");
      return;
    }

    setEnvoi(true);
    try {
      const reponse = await fetch("/api/paiements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          trackId: estAchat ? track.id : undefined,
          artistId: estAchat ? undefined : artist.id,
          montant: estAchat ? undefined : Number(montant),
          operateur,
          numero,
        }),
      });
      const donnees = await reponse.json();
      if (!reponse.ok) throw new Error(donnees.error);

      // Un fournisseur reel renvoie vers sa propre page ; la simulation reste
      // sur le site.
      if (donnees.urlPaiement?.startsWith("http")) {
        window.location.href = donnees.urlPaiement;
        return;
      }
      router.push(`/paiement/${donnees.reference}`);
    } catch (erreur) {
      toast.error(erreur.message || "Paiement impossible.");
      setEnvoi(false);
    }
  }

  return (
    <form onSubmit={payer} className="flex flex-col gap-4">
      <div>
        <p className="text-sm font-semibold text-white">
          {estAchat ? `Acheter « ${track.title} »` : `Soutenir ${artist.name}`}
        </p>
        <p className="text-xs text-white/45">
          {estAchat
            ? "Le telechargement s'ouvre des le paiement confirme."
            : "La somme revient a l'artiste, moins la part de la plateforme."}
        </p>
      </div>

      {!estAchat && (
        <div>
          <span className="label">Montant</span>
          <div className="mb-2 flex flex-wrap gap-2">
            {POURBOIRES.map((valeur) => (
              <button
                key={valeur}
                type="button"
                onClick={() => setMontant(valeur)}
                className={`chip ${montant === valeur ? "border-faso-gold text-faso-gold" : ""}`}
              >
                {formatCfa(valeur)}
              </button>
            ))}
          </div>
          <input
            type="number"
            min={100}
            step={100}
            value={montant}
            onChange={(evenement) => setMontant(evenement.target.value)}
            aria-label="Montant en francs CFA"
            className="input max-w-[12rem]"
          />
        </div>
      )}

      <div>
        <span className="label">Operateur</span>
        <div className="grid grid-cols-3 gap-2">
          {OPERATEURS.map((choix) => (
            <button
              key={choix.code}
              type="button"
              onClick={() => setOperateur(choix.code)}
              className={`rounded-lg border px-3 py-2 text-xs font-semibold transition ${
                operateur === choix.code
                  ? "border-faso-gold bg-faso-gold/10 text-faso-gold"
                  : "border-faso-line bg-black/30 text-white/65 hover:border-white/25"
              }`}
            >
              {choix.nom}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="label" htmlFor="numero">
          Numero mobile money
        </label>
        <input
          id="numero"
          value={numero}
          onChange={(evenement) => setNumero(evenement.target.value)}
          placeholder="70 00 00 00"
          inputMode="tel"
          required
          className="input max-w-[16rem]"
        />
        <p className="mt-1 text-[11px] text-white/35">8 chiffres, avec ou sans l&apos;indicatif +226.</p>
      </div>

      <div className="flex items-center gap-3">
        <button type="submit" disabled={envoi} className="btn-primary">
          <HiDevicePhoneMobile className="text-lg" />
          {envoi ? "Envoi..." : `Payer ${formatCfa(somme)}`}
        </button>
        {onClose && (
          <button type="button" onClick={onClose} className="btn-ghost">
            Annuler
          </button>
        )}
      </div>
    </form>
  );
}
