import path from "node:path";
import { newId } from "@/lib/ids";

/**
 * Stockage des medias.
 *
 * Sur une plateforme sans serveur, le disque d'une fonction est ephemere :
 * rien de ce qu'on y ecrit ne survit ni n'est partage. Les fichiers vont donc
 * dans un stockage objet, et l'application ne relaie jamais leurs octets.
 *
 * Le trajet d'un depot :
 *  1. le navigateur demande une adresse d'envoi signee ;
 *  2. il envoie le fichier directement au stockage — ce qui contourne aussi la
 *     limite de taille d'un corps de requete ;
 *  3. il previent l'application, qui enregistre le morceau.
 *
 * A la lecture, l'application verifie l'autorisation puis redirige vers une
 * adresse signee de courte duree. Elle decide qui a le droit ; elle ne fait
 * pas passer les octets.
 */

const URL_PROJET = process.env.SUPABASE_URL;
const CLE_SERVICE = process.env.SUPABASE_SERVICE_KEY;
export const SEAU = process.env.SUPABASE_BUCKET || "faso-zik";

/** Duree de validite d'une adresse signee, en secondes. */
const DUREE_LECTURE = Number(process.env.MEDIA_URL_DUREE || 300);
const DUREE_DEPOT = Number(process.env.MEDIA_DEPOT_DUREE || 900);

export const LIMITS = {
  audio: Number(process.env.MAX_AUDIO_MB || 40) * 1024 * 1024,
  video: Number(process.env.MAX_VIDEO_MB || 400) * 1024 * 1024,
  image: Number(process.env.MAX_IMAGE_MB || 8) * 1024 * 1024,
};

const EXTENSIONS = {
  "audio/mpeg": ".mp3",
  "audio/mp3": ".mp3",
  "audio/wav": ".wav",
  "audio/x-wav": ".wav",
  "audio/flac": ".flac",
  "audio/ogg": ".ogg",
  "audio/aac": ".aac",
  "audio/mp4": ".m4a",
  "audio/x-m4a": ".m4a",
  "video/mp4": ".mp4",
  "video/webm": ".webm",
  "video/quicktime": ".mov",
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/avif": ".avif",
};

export const ACCEPTED = {
  audio: ["audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav", "audio/flac", "audio/ogg", "audio/aac", "audio/mp4", "audio/x-m4a"],
  video: ["video/mp4", "video/webm", "video/quicktime"],
  image: ["image/jpeg", "image/png", "image/webp", "image/avif"],
};

export function stockageConfigure() {
  return !!(URL_PROJET && CLE_SERVICE);
}

export function extensionFor(mime, fallbackName = "") {
  return EXTENSIONS[mime] || path.extname(fallbackName).toLowerCase() || ".bin";
}

let client = null;

async function stockage() {
  if (!stockageConfigure()) {
    throw new Error("Stockage non configure : renseignez SUPABASE_URL et SUPABASE_SERVICE_KEY.");
  }
  if (!client) {
    const { createClient } = await import("@supabase/supabase-js");
    // La cle de service ne quitte jamais le serveur ; aucune session a garder.
    client = createClient(URL_PROJET, CLE_SERVICE, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client.storage.from(SEAU);
}

/**
 * Valide un chemin d'objet.
 *
 * Les chemins sont fabriques ici, mais ils transitent ensuite par la base et
 * par des adresses : on refuse tout ce qui sort de la forme attendue plutot
 * que de faire confiance a leur provenance.
 */
export function cheminValide(chemin) {
  return /^(audio|video|image|preview)\/[A-Za-z0-9._-]+$/.test(String(chemin || ""));
}

export function exigerChemin(chemin) {
  if (!cheminValide(chemin)) throw new Error("Chemin de media invalide.");
  return chemin;
}

/** Verifie type et taille avant de laisser envoyer quoi que ce soit. */
export function verifierDepot({ kind, mime, taille }) {
  if (!ACCEPTED[kind]) throw new Error(`Type de media inconnu : ${kind}`);
  if (!ACCEPTED[kind].includes(mime)) {
    throw new Error(`Format non accepte (${mime || "inconnu"}) pour un fichier ${kind}.`);
  }
  if (taille > LIMITS[kind]) {
    throw new Error(
      `Fichier trop volumineux : ${(taille / 1048576).toFixed(1)} Mo, maximum ${(
        LIMITS[kind] / 1048576
      ).toFixed(0)} Mo.`,
    );
  }
}

/** Adresse d'envoi direct, remise au navigateur apres verification. */
export async function adresseDeDepot({ kind, mime, taille, nom = "" }) {
  verifierDepot({ kind, mime, taille });

  const chemin = `${kind}/${newId()}${extensionFor(mime, nom)}`;
  const { data, error } = await (await stockage()).createSignedUploadUrl(chemin, {
    expiresIn: DUREE_DEPOT,
  });
  if (error) throw new Error(`Adresse d'envoi refusee : ${error.message}`);

  return { chemin, url: data.signedUrl, jeton: data.token };
}

/** Adresse de lecture, valable quelques minutes. */
export async function adresseDeLecture(chemin, { telechargement = null } = {}) {
  exigerChemin(chemin);

  const { data, error } = await (await stockage()).createSignedUrl(chemin, DUREE_LECTURE, {
    // Renseigne le nom du fichier propose a l'enregistrement.
    ...(telechargement ? { download: telechargement } : {}),
  });
  if (error) throw new Error(`Media introuvable : ${error.message}`);

  return data.signedUrl;
}

/** Depot cote serveur, pour le catalogue de demonstration et les tests. */
export async function deposerObjet(chemin, contenu, mime) {
  exigerChemin(chemin);

  const { error } = await (await stockage()).upload(chemin, contenu, {
    contentType: mime,
    upsert: true,
  });
  if (error) throw new Error(`Depot refuse : ${error.message}`);
  return chemin;
}

export async function supprimerObjet(chemin) {
  if (!chemin || !cheminValide(chemin)) return;
  await (await stockage()).remove([chemin]);
}

export async function supprimerObjets(chemins) {
  const valides = (chemins || []).filter(cheminValide);
  if (!valides.length) return;
  await (await stockage()).remove(valides);
}
