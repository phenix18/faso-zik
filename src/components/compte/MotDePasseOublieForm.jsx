"use client";

import { useState } from "react";
import Link from "next/link";
import Logo from "@/components/Logo";

export default function MotDePasseOublieForm() {
  const [etat, setEtat] = useState({ envoi: false, message: null, erreur: null });

  async function soumettre(evenement) {
    evenement.preventDefault();
    const email = new FormData(evenement.currentTarget).get("email");
    setEtat({ envoi: true, message: null, erreur: null });

    try {
      const reponse = await fetch("/api/mot-de-passe/oubli", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const donnees = await reponse.json();
      if (!reponse.ok) throw new Error(donnees.error);
      setEtat({ envoi: false, message: donnees.message, erreur: null });
    } catch (erreur) {
      setEtat({ envoi: false, message: null, erreur: erreur.message || "Demande impossible." });
    }
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center">
      <div className="card">
        <Logo className="mb-4" />
        <h1 className="text-xl font-bold text-white">Mot de passe oublie</h1>
        <p className="mb-5 mt-1 text-sm text-white/45">
          Indiquez l&apos;adresse de votre compte : un lien pour choisir un nouveau mot de passe
          vous sera envoye.
        </p>

        {etat.message ? (
          <p className="rounded-lg border border-faso-green/40 bg-faso-green/10 p-3 text-sm text-faso-green">
            {etat.message}
          </p>
        ) : (
          <form onSubmit={soumettre} className="flex flex-col gap-3">
            <div>
              <label className="label" htmlFor="email">
                Adresse e-mail
              </label>
              <input id="email" name="email" type="email" required className="input" />
            </div>
            {etat.erreur && (
              <p className="rounded-lg border border-faso-red/40 bg-faso-red/10 p-3 text-sm text-faso-red">
                {etat.erreur}
              </p>
            )}
            <button type="submit" disabled={etat.envoi} className="btn-primary mt-1">
              {etat.envoi ? "Envoi..." : "Envoyer le lien"}
            </button>
          </form>
        )}

        <p className="mt-4 text-sm text-white/45">
          <Link href="/connexion" className="font-semibold text-faso-gold hover:underline">
            Retour a la connexion
          </Link>
        </p>
      </div>
    </div>
  );
}
