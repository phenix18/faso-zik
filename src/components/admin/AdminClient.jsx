"use client";

import { useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { HiCheckBadge, HiEyeSlash } from "react-icons/hi2";
import { formatCount } from "@/lib/format";

export default function AdminClient({ resume, artistes, titres }) {
  const [liste, setListe] = useState(artistes);
  const [catalogue, setCatalogue] = useState(titres);
  const [enCours, setEnCours] = useState(null);

  const cartes = [
    ["Comptes", resume.comptes],
    ["Artistes", `${resume.artistesVerifies} / ${resume.artistes} verifies`],
    ["Titres en ligne", `${resume.titresEnLigne} / ${resume.titres}`],
    ["Ecoutes (7 j)", formatCount(resume.ecoutes7j)],
    ["Paiements aboutis", resume.paiements],
  ];

  async function agir(corps, surSucces) {
    setEnCours(corps.artistId || corps.trackId);
    try {
      const reponse = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(corps),
      });
      const donnees = await reponse.json();
      if (!reponse.ok) throw new Error(donnees.error);
      surSucces(donnees);
    } catch (erreur) {
      toast.error(erreur.message || "Action impossible.");
    } finally {
      setEnCours(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-widest text-faso-gold">
          Administration
        </p>
        <h1 className="text-2xl font-black text-white">Vue d&apos;ensemble</h1>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {cartes.map(([libelle, valeur]) => (
          <div key={libelle} className="card !p-3">
            <p className="text-[11px] uppercase tracking-wide text-white/40">{libelle}</p>
            <p className="mt-1 text-lg font-black text-white">{valeur}</p>
          </div>
        ))}
      </div>

      <section>
        <h2 className="mb-2 text-sm font-bold text-white">Artistes</h2>
        <p className="mb-3 text-xs text-white/40">
          La verification signale un artiste dont l&apos;identite a ete controlee. Elle n&apos;ouvre
          aucun droit supplementaire.
        </p>
        <div className="flex flex-col gap-2">
          {liste.map((artiste) => (
            <div key={artiste.id} className="card flex items-center gap-3 !p-3">
              <div className="min-w-0 flex-1">
                <Link
                  href={`/artistes/${artiste.slug}`}
                  className="flex items-center gap-1.5 truncate text-sm font-semibold text-white hover:text-faso-gold"
                >
                  {artiste.name}
                  {!!artiste.verified && <HiCheckBadge className="text-faso-gold" />}
                </Link>
                <p className="truncate text-[11px] text-white/40">
                  {artiste.email || "sans compte"} · {artiste.titres} titre(s) ·{" "}
                  {artiste.city || "ville non renseignee"}
                </p>
              </div>
              <button
                type="button"
                disabled={enCours === artiste.id}
                onClick={() =>
                  agir({ action: "verifier", artistId: artiste.id }, ({ verifie }) => {
                    setListe((actuelle) =>
                      actuelle.map((item) =>
                        item.id === artiste.id ? { ...item, verified: verifie } : item,
                      ),
                    );
                    toast.success(verifie ? "Artiste verifie." : "Verification retiree.");
                  })
                }
                className="btn-ghost !px-3 !py-1.5"
              >
                {artiste.verified ? "Retirer la verification" : "Verifier"}
              </button>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-bold text-white">Derniers depots</h2>
        <p className="mb-3 text-xs text-white/40">
          Le retrait depublie le titre sans effacer le fichier : une reclamation peut se reveler
          infondee.
        </p>
        <div className="flex flex-col gap-1">
          {catalogue.map((titre) => (
            <div
              key={titre.id}
              className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-white/5"
            >
              <div className="min-w-0 flex-1">
                <Link
                  href={`/titre/${titre.id}`}
                  className="truncate text-sm text-white hover:text-faso-gold"
                >
                  {titre.title}
                </Link>
                <p className="truncate text-[11px] text-white/40">
                  {titre.artiste} · {titre.kind === "video" ? "clip" : "audio"} ·{" "}
                  {titre.created_at?.slice(0, 10)}
                </p>
              </div>
              {titre.published ? (
                <button
                  type="button"
                  disabled={enCours === titre.id}
                  onClick={() =>
                    agir({ action: "retirer", trackId: titre.id }, () => {
                      setCatalogue((actuel) =>
                        actuel.map((item) =>
                          item.id === titre.id ? { ...item, published: 0 } : item,
                        ),
                      );
                      toast.success("Titre retire de la diffusion.");
                    })
                  }
                  className="btn-ghost !px-3 !py-1.5 !text-faso-red"
                >
                  <HiEyeSlash /> Retirer
                </button>
              ) : (
                <span className="chip">Retire</span>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
