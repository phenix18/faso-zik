"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

/** Un auditeur qui veut publier ouvre ici sa fiche artiste. */
export default function OpenArtistSpace({ defaultName }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function submit(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    try {
      const response = await fetch("/api/artist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stageName: form.get("stageName"),
          city: form.get("city"),
          bio: form.get("bio"),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      toast.success("Espace artiste ouvert.");
      router.refresh();
    } catch (error) {
      toast.error(error.message || "Ouverture impossible.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg">
      <div className="card">
        <h1 className="text-xl font-bold text-white">Ouvrir mon espace artiste</h1>
        <p className="mb-5 mt-1 text-sm text-white/45">
          Votre compte devient un compte artiste : vous pourrez publier des titres et des clips, et
          fixer titre par titre ce qui est telechargeable ou utilisable en platine.
        </p>

        <form onSubmit={submit} className="flex flex-col gap-3">
          <div>
            <label className="label" htmlFor="stageName">
              Nom d&apos;artiste
            </label>
            <input id="stageName" name="stageName" defaultValue={defaultName} className="input" />
          </div>
          <div>
            <label className="label" htmlFor="city">
              Ville
            </label>
            <input id="city" name="city" placeholder="Bobo-Dioulasso" className="input" />
          </div>
          <div>
            <label className="label" htmlFor="bio">
              Presentation
            </label>
            <textarea id="bio" name="bio" rows={4} className="input" />
          </div>
          <button type="submit" disabled={pending} className="btn-primary mt-1">
            {pending ? "Ouverture..." : "Ouvrir mon studio"}
          </button>
        </form>
      </div>
    </div>
  );
}
