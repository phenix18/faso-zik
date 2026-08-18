"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import toast from "react-hot-toast";
import Logo from "@/components/Logo";

export default function SignupForm() {
  const router = useRouter();
  const [role, setRole] = useState("auditeur");
  const [pending, setPending] = useState(false);

  async function submit(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = {
      name: form.get("name"),
      email: form.get("email"),
      password: form.get("password"),
      role,
      city: form.get("city") || undefined,
      bio: form.get("bio") || undefined,
    };

    setPending(true);
    try {
      const response = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      await signIn("credentials", {
        email: payload.email,
        password: payload.password,
        redirect: false,
      });
      toast.success("Compte cree. Bienvenue sur FASO-ZIK !");
      router.push(role === "artiste" ? "/studio" : "/");
      router.refresh();
    } catch (error) {
      toast.error(error.message || "Inscription impossible.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center">
      <div className="card">
        <Logo className="mb-4" />
        <h1 className="text-xl font-bold text-white">Creer un compte</h1>
        <p className="mb-5 text-sm text-white/45">
          Ecouter est libre. Publier demande un compte artiste.
        </p>

        <div className="mb-4 grid grid-cols-2 gap-2">
          {[
            ["auditeur", "Auditeur", "Ecouter, telecharger, mixer"],
            ["artiste", "Artiste", "Publier et gerer mes droits"],
          ].map(([value, label, hint]) => (
            <button
              key={value}
              type="button"
              onClick={() => setRole(value)}
              className={`rounded-lg border p-3 text-left transition ${
                role === value
                  ? "border-faso-gold bg-faso-gold/10"
                  : "border-faso-line bg-black/30 hover:border-white/25"
              }`}
            >
              <span className="block text-sm font-semibold text-white">{label}</span>
              <span className="block text-[11px] text-white/45">{hint}</span>
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="flex flex-col gap-3">
          <div>
            <label className="label" htmlFor="name">
              {role === "artiste" ? "Nom d'artiste" : "Nom"}
            </label>
            <input id="name" name="name" required minLength={2} className="input" />
          </div>
          <div>
            <label className="label" htmlFor="email">
              Adresse e-mail
            </label>
            <input id="email" name="email" type="email" required className="input" />
          </div>
          <div>
            <label className="label" htmlFor="password">
              Mot de passe (8 caracteres minimum)
            </label>
            <input id="password" name="password" type="password" required minLength={8} className="input" />
          </div>

          {role === "artiste" && (
            <>
              <div>
                <label className="label" htmlFor="city">
                  Ville
                </label>
                <input id="city" name="city" placeholder="Ouagadougou" className="input" />
              </div>
              <div>
                <label className="label" htmlFor="bio">
                  Presentation
                </label>
                <textarea id="bio" name="bio" rows={3} className="input" />
              </div>
            </>
          )}

          <button type="submit" disabled={pending} className="btn-primary mt-2">
            {pending ? "Creation..." : "Creer mon compte"}
          </button>
        </form>

        <p className="mt-4 text-sm text-white/45">
          Deja inscrit ?{" "}
          <Link href="/connexion" className="font-semibold text-faso-gold hover:underline">
            Se connecter
          </Link>
        </p>
      </div>
    </div>
  );
}
