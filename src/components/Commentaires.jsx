"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import toast from "react-hot-toast";
import { HiChatBubbleLeftRight, HiTrash } from "react-icons/hi2";

/**
 * Commentaires sous un morceau.
 *
 * Lire est ouvert a tous, ecrire demande un compte : c'est ce qui rend un
 * retrait possible et decourage le deversement anonyme. Le serveur applique la
 * meme regle — ce bouton grise n'est qu'une politesse.
 */
export default function Commentaires({ trackId, artistId }) {
  const { data: session, status } = useSession();
  const [liste, setListe] = useState([]);
  const [corps, setCorps] = useState("");
  const [chargement, setChargement] = useState(true);
  const [envoi, setEnvoi] = useState(false);

  useEffect(() => {
    let vivant = true;
    fetch(`/api/commentaires?titre=${encodeURIComponent(trackId)}`)
      .then((r) => r.json())
      .then((d) => vivant && setListe(d.commentaires || []))
      .catch(() => vivant && setListe([]))
      .finally(() => vivant && setChargement(false));
    return () => {
      vivant = false;
    };
  }, [trackId]);

  async function envoyer(evenement) {
    evenement.preventDefault();
    if (!corps.trim() || envoi) return;

    setEnvoi(true);
    try {
      const reponse = await fetch("/api/commentaires", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trackId, corps }),
      });
      const donnees = await reponse.json();
      if (!reponse.ok) throw new Error(donnees.error || "Envoi impossible.");

      setListe((actuelle) => [donnees.commentaire, ...actuelle]);
      setCorps("");
    } catch (erreur) {
      toast.error(erreur.message);
    } finally {
      setEnvoi(false);
    }
  }

  async function retirer(id) {
    const reponse = await fetch(`/api/commentaires/${id}`, { method: "DELETE" });
    if (!reponse.ok) {
      const donnees = await reponse.json().catch(() => ({}));
      toast.error(donnees.error || "Retrait impossible.");
      return;
    }
    setListe((actuelle) => actuelle.filter((c) => c.id !== id));
    toast.success("Commentaire retire.");
  }

  // L'artiste du morceau et l'administration moderent leur page ; l'auteur
  // retire ce qu'il a ecrit.
  const moi = session?.user;
  const peutModerer = (commentaire) =>
    moi &&
    (moi.id === commentaire.auteur.id || moi.role === "admin" || (artistId && moi.artistId === artistId));

  return (
    <section className="mt-8">
      <h2 className="mb-3 flex items-center gap-2 text-lg font-bold">
        <HiChatBubbleLeftRight className="text-faso-gold" />
        Commentaires
        {liste.length > 0 && <span className="text-sm text-white/40">({liste.length})</span>}
      </h2>

      {status === "authenticated" ? (
        <form onSubmit={envoyer} className="mb-5">
          <textarea
            value={corps}
            onChange={(evenement) => setCorps(evenement.target.value)}
            rows={3}
            maxLength={2000}
            placeholder="Ce que ce morceau vous inspire…"
            className="w-full resize-y rounded-lg border border-faso-line bg-black/40 p-3 text-sm outline-none focus:border-faso-gold"
          />
          <div className="mt-2 flex items-center justify-between">
            <span className="text-[11px] text-white/35">{corps.length} / 2000</span>
            <button type="submit" disabled={envoi || !corps.trim()} className="btn-primary !py-1.5">
              {envoi ? "Envoi…" : "Publier"}
            </button>
          </div>
        </form>
      ) : (
        <p className="mb-5 rounded-lg border border-faso-line bg-black/30 p-3 text-sm text-white/55">
          <Link href="/connexion" className="font-semibold text-faso-gold hover:underline">
            Connectez-vous
          </Link>{" "}
          pour laisser un commentaire. L&apos;ecoute, elle, reste libre.
        </p>
      )}

      {chargement ? (
        <p className="text-sm text-white/40">Chargement…</p>
      ) : liste.length === 0 ? (
        <p className="text-sm text-white/40">Aucun commentaire pour l&apos;instant.</p>
      ) : (
        <ul className="space-y-3">
          {liste.map((commentaire) => (
            <li key={commentaire.id} className="rounded-lg border border-faso-line bg-black/25 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white/85">{commentaire.auteur.nom}</p>
                  <p className="mt-1 whitespace-pre-wrap break-words text-sm text-white/70">
                    {commentaire.corps}
                  </p>
                </div>
                {peutModerer(commentaire) && (
                  <button
                    type="button"
                    onClick={() => retirer(commentaire.id)}
                    title="Retirer ce commentaire"
                    className="shrink-0 rounded p-1.5 text-white/35 hover:bg-white/5 hover:text-red-400"
                  >
                    <HiTrash />
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
