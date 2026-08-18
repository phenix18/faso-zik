"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import toast from "react-hot-toast";
import Logo from "@/components/Logo";

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";
  const [pending, setPending] = useState(false);

  async function submit(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);

    const result = await signIn("credentials", {
      email: form.get("email"),
      password: form.get("password"),
      redirect: false,
    });
    setPending(false);

    if (result?.error) {
      toast.error("E-mail ou mot de passe incorrect.");
      return;
    }
    toast.success("Bienvenue sur FASO-ZIK.");
    router.push(callbackUrl);
    router.refresh();
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center">
      <div className="card">
        <Logo className="mb-4" />
        <h1 className="text-xl font-bold text-white">Connexion</h1>
        <p className="mb-5 text-sm text-white/45">
          Retrouvez vos favoris, vos playlists et votre studio d&apos;artiste.
        </p>

        <form onSubmit={submit} className="flex flex-col gap-3">
          <div>
            <label className="label" htmlFor="email">
              Adresse e-mail
            </label>
            <input id="email" name="email" type="email" required className="input" />
          </div>
          <div>
            <label className="label" htmlFor="password">
              Mot de passe
            </label>
            <input id="password" name="password" type="password" required className="input" />
          </div>
          <button type="submit" disabled={pending} className="btn-primary mt-2">
            {pending ? "Connexion..." : "Se connecter"}
          </button>
        </form>

        <p className="mt-4 text-sm text-white/45">
          Pas encore de compte ?{" "}
          <Link href="/inscription" className="font-semibold text-faso-gold hover:underline">
            Creer un compte
          </Link>
        </p>
      </div>
    </div>
  );
}
