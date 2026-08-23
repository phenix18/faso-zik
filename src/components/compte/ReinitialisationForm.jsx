"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import toast from "react-hot-toast";
import Logo from "@/components/Logo";

export default function ReinitialisationForm({ jeton }) {
  const router = useRouter();
  const [valide, setValide] = useState(null);
  const [envoi, setEnvoi] = useState(false);

  // Le lien est verifie avant d'afficher le formulaire : mieux vaut le dire
  // tout de suite que apres la saisie d'un mot de passe.
  useEffect(() => {
    fetch(`/api/mot-de-passe/reinitialiser?jeton=${encodeURIComponent(jeton)}`)
      .then((reponse) => reponse.json())
      .then((donnees) => setValide(!!donnees.valide))
      .catch(() => setValide(false));
  }, [jeton]);

  async function soumettre(evenement) {
    evenement.preventDefault();
    const motDePasse = new FormData(evenement.currentTarget).get("motDePasse");
    setEnvoi(true);

    try {
      const reponse = await fetch("/api/mot-de-passe/reinitialiser", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jeton, motDePasse }),
      });
      const donnees = await reponse.json();
      if (!reponse.ok) throw new Error(donnees.error);

      toast.success("Mot de passe change.");
      router.push("/connexion");
    } catch (erreur) {
      toast.error(erreur.message || "Changement impossible.");
      setEnvoi(false);
    }
  }

  if (valide === null) {
    return <p className="py-20 text-center text-sm text-white/40">Verification du lien...</p>;
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center">
      <div className="card">
        <Logo className="mb-4" />
        {valide ? (
          <>
            <h1 className="text-xl font-bold text-white">Nouveau mot de passe</h1>
            <p className="mb-5 mt-1 text-sm text-white/45">
              Choisissez un mot de passe d&apos;au moins 8 caracteres.
            </p>
            <form onSubmit={soumettre} className="flex flex-col gap-3">
              <div>
                <label className="label" htmlFor="motDePasse">
                  Mot de passe
                </label>
                <input
                  id="motDePasse"
                  name="motDePasse"
                  type="password"
                  required
                  minLength={8}
                  className="input"
                />
              </div>
              <button type="submit" disabled={envoi} className="btn-primary mt-1">
                {envoi ? "Enregistrement..." : "Changer mon mot de passe"}
              </button>
            </form>
          </>
        ) : (
          <>
            <h1 className="text-xl font-bold text-white">Lien expire</h1>
            <p className="mb-5 mt-1 text-sm text-white/45">
              Ce lien a expire ou a deja servi. Demandez-en un nouveau.
            </p>
            <Link href="/mot-de-passe-oublie" className="btn-primary">
              Nouvelle demande
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
