"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { HiArrowDownTray, HiCheckCircle, HiXCircle } from "react-icons/hi2";
import { formatCfa } from "@/lib/format";

/**
 * Page d'attente d'un paiement.
 *
 * L'auditeur confirme sur son telephone ; le site interroge le serveur toutes
 * les trois secondes, qui interroge lui-meme le fournisseur si la notification
 * n'est pas encore arrivee.
 */
export default function SuiviPaiement({ reference }) {
  const [paiement, setPaiement] = useState(null);
  const [erreur, setErreur] = useState(null);
  const [simulation, setSimulation] = useState(false);

  const relire = useCallback(async () => {
    try {
      const reponse = await fetch(`/api/paiements/${reference}`);
      const donnees = await reponse.json();
      if (!reponse.ok) throw new Error(donnees.error);
      setPaiement(donnees.paiement);
      return donnees.paiement.statut;
    } catch (probleme) {
      setErreur(probleme.message);
      return "erreur";
    }
  }, [reference]);

  useEffect(() => {
    setSimulation(new URLSearchParams(window.location.search).has("simulation"));
  }, []);

  useEffect(() => {
    let actif = true;
    relire();

    const minuteur = setInterval(async () => {
      const statut = await relire();
      if (!actif || statut !== "attente") clearInterval(minuteur);
    }, 3000);

    return () => {
      actif = false;
      clearInterval(minuteur);
    };
  }, [relire]);

  async function confirmerSimulation(resultat) {
    await fetch(`/api/paiements/${reference}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resultat }),
    });
    relire();
  }

  if (erreur) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-3 text-center">
        <HiXCircle className="text-4xl text-faso-red" />
        <h1 className="text-lg font-bold text-white">Paiement introuvable</h1>
        <p className="text-sm text-white/50">{erreur}</p>
        <Link href="/" className="btn-ghost">
          Retour a l&apos;accueil
        </Link>
      </div>
    );
  }

  if (!paiement) {
    return <p className="py-20 text-center text-sm text-white/40">Chargement du paiement...</p>;
  }

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col justify-center">
      <div className="card text-center">
        <p className="text-xs uppercase tracking-widest text-white/40">Reference</p>
        <p className="font-mono text-sm text-white/70">{paiement.reference}</p>
        <p className="mt-4 text-3xl font-black text-white">{formatCfa(paiement.montant)}</p>
        <p className="text-xs text-white/45">
          {paiement.type === "achat" ? "Achat d'un titre" : "Soutien a un artiste"} ·{" "}
          {paiement.operateur}
        </p>

        {paiement.statut === "attente" && (
          <div className="mt-6">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-faso-line border-t-faso-gold" />
            <p className="mt-3 text-sm text-white/60">
              Confirmez le paiement sur votre telephone. Cette page se met a jour toute seule.
            </p>
          </div>
        )}

        {paiement.statut === "paye" && (
          <div className="mt-6 flex flex-col items-center gap-3">
            <HiCheckCircle className="text-4xl text-faso-green" />
            <p className="text-sm font-semibold text-white">Paiement recu. Merci !</p>
            {paiement.trackId && (
              <a href={`/api/download/${paiement.trackId}`} className="btn-primary">
                <HiArrowDownTray className="text-lg" /> Telecharger le titre
              </a>
            )}
            <Link href="/" className="text-xs text-white/45 hover:text-white">
              Retour a l&apos;accueil
            </Link>
          </div>
        )}

        {paiement.statut === "echoue" && (
          <div className="mt-6 flex flex-col items-center gap-3">
            <HiXCircle className="text-4xl text-faso-red" />
            <p className="text-sm text-white/70">
              Le paiement n&apos;a pas abouti. Rien n&apos;a ete preleve.
            </p>
            <Link href="/" className="btn-ghost">
              Retour a l&apos;accueil
            </Link>
          </div>
        )}

        {simulation && paiement.statut === "attente" && (
          <div className="mt-6 rounded-lg border border-dashed border-faso-line p-3">
            <p className="mb-2 text-[11px] text-white/40">
              Mode simulation : aucun operateur n&apos;est appele. Choisissez l&apos;issue.
            </p>
            <div className="flex justify-center gap-2">
              <button
                type="button"
                onClick={() => confirmerSimulation("paye")}
                className="btn-ghost !px-3 !py-1.5 !text-faso-green"
              >
                Simuler un paiement recu
              </button>
              <button
                type="button"
                onClick={() => confirmerSimulation("echoue")}
                className="btn-ghost !px-3 !py-1.5 !text-faso-red"
              >
                Simuler un echec
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
