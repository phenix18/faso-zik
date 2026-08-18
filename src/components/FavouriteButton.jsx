"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import toast from "react-hot-toast";
import { HiHeart, HiOutlineHeart } from "react-icons/hi2";

export default function FavouriteButton({ trackId, initial = false, className = "" }) {
  const { status } = useSession();
  const [liked, setLiked] = useState(initial);
  const [pending, setPending] = useState(false);

  async function toggle(event) {
    event.preventDefault();
    event.stopPropagation();
    if (status !== "authenticated") {
      toast("Connectez-vous pour enregistrer vos favoris.");
      return;
    }

    setPending(true);
    const optimistic = !liked;
    setLiked(optimistic);
    try {
      const response = await fetch("/api/favourites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trackId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setLiked(data.favourite);
    } catch (error) {
      setLiked(!optimistic);
      toast.error(error.message || "Impossible de mettre a jour les favoris.");
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      aria-pressed={liked}
      aria-label={liked ? "Retirer des favoris" : "Ajouter aux favoris"}
      className={`text-xl transition hover:scale-110 ${liked ? "text-faso-red" : "text-white/45 hover:text-white"} ${className}`}
    >
      {liked ? <HiHeart /> : <HiOutlineHeart />}
    </button>
  );
}
