"use client";

import { useState } from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { HiExclamationTriangle } from "react-icons/hi2";

export default function CompteClient({ compte, artiste, titres }) {
  const router = useRouter();
  const [nom, setNom] = useState(compte.name);
  const [envoi, setEnvoi] = useState(null);
  const [confirmation, setConfirmation] = useState("");

  async function appeler(methode, corps) {
    const reponse = await fetch("/api/compte", {
      method: methode,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(corps),
    });
    const donnees = await reponse.json();
    if (!reponse.ok) throw new Error(donnees.error);
    return donnees;
  }

  async function enregistrerNom(evenement) {
    evenement.preventDefault();
    setEnvoi("nom");
    try {
      await appeler("PATCH", { name: nom });
      toast.success("Nom mis a jour.");
      router.refresh();
    } catch (erreur) {
      toast.error(erreur.message);
    } finally {
      setEnvoi(null);
    }
  }

  async function changerMotDePasse(evenement) {
    evenement.preventDefault();
    const formulaire = new FormData(evenement.currentTarget);
    setEnvoi("motDePasse");
    try {
      await appeler("PATCH", {
        ancienMotDePasse: formulaire.get("ancien"),
        nouveauMotDePasse: formulaire.get("nouveau"),
      });
      toast.success("Mot de passe change.");
      evenement.target.reset();
    } catch (erreur) {
      toast.error(erreur.message);
    } finally {
      setEnvoi(null);
    }
  }

  async function supprimer() {
    setEnvoi("suppression");
    try {
      await appeler("DELETE", { confirmation: "SUPPRIMER" });
      toast.success("Compte supprime.");
      await signOut({ callbackUrl: "/" });
    } catch (erreur) {
      toast.error(erreur.message);
      setEnvoi(null);
    }
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-widest text-faso-gold">Mon compte</p>
        <h1 className="text-2xl font-black text-white">{compte.name}</h1>
        <p className="text-sm text-white/45">
          {compte.email} ·{" "}
          <span className={compte.role === "admin" ? "font-semibold text-faso-gold" : ""}>
            {compte.role}
          </span>
          {artiste && (
            <>
              {" · "}
              <Link href={`/artistes/${artiste.slug}`} className="text-faso-gold hover:underline">
                page artiste
              </Link>
            </>
          )}
        </p>
      </header>

      <form onSubmit={enregistrerNom} className="card flex flex-col gap-3">
        <h2 className="text-sm font-bold text-white">Nom affiche</h2>
        <input
          value={nom}
          onChange={(evenement) => setNom(evenement.target.value)}
          minLength={2}
          required
          aria-label="Nom affiche"
          className="input max-w-sm"
        />
        <button type="submit" disabled={envoi === "nom"} className="btn-primary self-start">
          Enregistrer
        </button>
      </form>

      <form onSubmit={changerMotDePasse} className="card flex flex-col gap-3">
        <h2 className="text-sm font-bold text-white">Changer de mot de passe</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="ancien">
              Mot de passe actuel
            </label>
            <input id="ancien" name="ancien" type="password" required className="input" />
          </div>
          <div>
            <label className="label" htmlFor="nouveau">
              Nouveau mot de passe
            </label>
            <input
              id="nouveau"
              name="nouveau"
              type="password"
              required
              minLength={8}
              className="input"
            />
          </div>
        </div>
        <button type="submit" disabled={envoi === "motDePasse"} className="btn-primary self-start">
          Changer
        </button>
      </form>

      <section className="card !border-faso-red/40 !bg-faso-red/5">
        <h2 className="flex items-center gap-2 text-sm font-bold text-faso-red">
          <HiExclamationTriangle /> Supprimer mon compte
        </h2>
        <p className="mt-2 text-sm text-white/60">
          La suppression est definitive. Vos favoris et vos playlists disparaissent.
          {titres > 0 && (
            <>
              {" "}
              <strong className="text-faso-red">
                Vos {titres} titre(s) et leurs fichiers seront egalement effaces
              </strong>{" "}
              : les auditeurs qui les ont achetes n&apos;y auront plus acces.
            </>
          )}
        </p>
        <p className="mt-3 text-xs text-white/45">
          Pour confirmer, tapez <code className="text-faso-red">SUPPRIMER</code> ci-dessous.
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <input
            value={confirmation}
            onChange={(evenement) => setConfirmation(evenement.target.value)}
            aria-label="Confirmation de suppression"
            className="input max-w-[12rem]"
          />
          <button
            type="button"
            disabled={confirmation !== "SUPPRIMER" || envoi === "suppression"}
            onClick={supprimer}
            className="btn !bg-faso-red !text-white hover:!bg-faso-red/90"
          >
            {envoi === "suppression" ? "Suppression..." : "Supprimer definitivement"}
          </button>
        </div>
      </section>
    </div>
  );
}
