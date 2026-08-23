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
 *
 * Deux fournisseurs derriere la meme interface : Supabase Storage, et tout
 * stockage compatible S3 (Cloudflare R2, Backblaze B2, MinIO, S3 lui-meme).
 * Le second existe parce que le trafic sortant est ce qui coute cher a un site
 * de musique, et que certains le facturent zero. Changer d'hebergeur ne doit
 * pas demander de rouvrir le reste de l'application.
 */

const URL_PROJET = process.env.SUPABASE_URL;
const CLE_SERVICE = process.env.SUPABASE_SERVICE_KEY;

const S3_ENDPOINT = process.env.S3_ENDPOINT;
const S3_CLE = process.env.S3_ACCESS_KEY_ID;
const S3_SECRET = process.env.S3_SECRET_ACCESS_KEY;
const S3_REGION = process.env.S3_REGION || "auto";

/**
 * Fournisseur retenu. Declare explicitement, ou devine d'apres les variables
 * presentes : renseigner les identifiants S3 suffit a basculer.
 */
export const FOURNISSEUR =
  (process.env.STOCKAGE_FOURNISSEUR || "").toLowerCase() ||
  (URL_PROJET && CLE_SERVICE ? "supabase" : "s3");

export const SEAU =
  FOURNISSEUR === "s3"
    ? process.env.S3_BUCKET || "faso-zik"
    : process.env.SUPABASE_BUCKET || "faso-zik";

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
  if (FOURNISSEUR === "s3") return !!(S3_ENDPOINT && S3_CLE && S3_SECRET);
  return !!(URL_PROJET && CLE_SERVICE);
}

function exigerStockage() {
  if (stockageConfigure()) return;
  throw new Error(
    FOURNISSEUR === "s3"
      ? "Stockage non configure : renseignez S3_ENDPOINT, S3_ACCESS_KEY_ID et S3_SECRET_ACCESS_KEY."
      : "Stockage non configure : renseignez SUPABASE_URL et SUPABASE_SERVICE_KEY.",
  );
}

export function extensionFor(mime, fallbackName = "") {
  return EXTENSIONS[mime] || path.extname(fallbackName).toLowerCase() || ".bin";
}

let client = null;

async function seauSupabase() {
  if (!client) {
    const { createClient } = await import("@supabase/supabase-js");
    // La cle de service ne quitte jamais le serveur ; aucune session a garder.
    client = createClient(URL_PROJET, CLE_SERVICE, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client.storage.from(SEAU);
}

const adaptateurSupabase = {
  async depot(chemin) {
    const { data, error } = await (await seauSupabase()).createSignedUploadUrl(chemin, {
      expiresIn: DUREE_DEPOT,
    });
    if (error) throw new Error(`Adresse d'envoi refusee : ${error.message}`);
    return { url: data.signedUrl, jeton: data.token };
  },

  async lecture(chemin, telechargement) {
    const { data, error } = await (await seauSupabase()).createSignedUrl(chemin, DUREE_LECTURE, {
      // Renseigne le nom du fichier propose a l'enregistrement.
      ...(telechargement ? { download: telechargement } : {}),
    });
    if (error) throw new Error(`Media introuvable : ${error.message}`);
    return data.signedUrl;
  },

  async deposer(chemin, contenu, mime) {
    const { error } = await (await seauSupabase()).upload(chemin, contenu, {
      contentType: mime,
      upsert: true,
    });
    if (error) throw new Error(`Depot refuse : ${error.message}`);
  },

  async supprimer(chemins) {
    await (await seauSupabase()).remove(chemins);
  },
};

let clientS3 = null;

async function s3() {
  if (!clientS3) {
    const { S3Client } = await import("@aws-sdk/client-s3");
    clientS3 = new S3Client({
      region: S3_REGION,
      endpoint: S3_ENDPOINT,
      credentials: { accessKeyId: S3_CLE, secretAccessKey: S3_SECRET },
      // R2 et B2 servent le seau dans le chemin, pas en sous-domaine.
      forcePathStyle: true,
    });
  }
  return clientS3;
}

async function signer(commande, duree) {
  const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");
  return getSignedUrl(await s3(), commande, { expiresIn: duree });
}

const adaptateurS3 = {
  async depot(chemin) {
    const { PutObjectCommand } = await import("@aws-sdk/client-s3");
    // Le type n'est pas signe : le navigateur l'envoie a l'octet pres, et une
    // difference de casse ou un charset ajoute feraient rejeter la signature.
    // Il est enregistre tel qu'il arrive, et de toute facon deja verifie ici.
    const url = await signer(new PutObjectCommand({ Bucket: SEAU, Key: chemin }), DUREE_DEPOT);
    return { url, jeton: null };
  },

  async lecture(chemin, telechargement) {
    const { GetObjectCommand } = await import("@aws-sdk/client-s3");
    return signer(
      new GetObjectCommand({
        Bucket: SEAU,
        Key: chemin,
        // Le nom est borne ici aussi : une bibliotheque ne doit pas dependre de
        // l'assainissement de son appelant pour produire un en-tete valide.
        ...(telechargement
          ? {
              ResponseContentDisposition: `attachment; filename="${String(telechargement)
                .replace(/[\u0000-\u001f\u007f"\\]/g, "")
                .slice(0, 150)}"`,
            }
          : {}),
      }),
      DUREE_LECTURE,
    );
  },

  async deposer(chemin, contenu, mime) {
    const { PutObjectCommand } = await import("@aws-sdk/client-s3");
    await (await s3()).send(
      new PutObjectCommand({ Bucket: SEAU, Key: chemin, Body: contenu, ContentType: mime }),
    );
  },

  async supprimer(chemins) {
    const { DeleteObjectsCommand } = await import("@aws-sdk/client-s3");
    await (await s3()).send(
      new DeleteObjectsCommand({
        Bucket: SEAU,
        Delete: { Objects: chemins.map((chemin) => ({ Key: chemin })), Quiet: true },
      }),
    );
  },
};

function stockage() {
  exigerStockage();
  return FOURNISSEUR === "s3" ? adaptateurS3 : adaptateurSupabase;
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

/**
 * Retrouve le chemin de stockage derriere une adresse de pochette.
 *
 * Les pochettes sont rangees en base sous la forme d'une adresse servie par
 * l'application ; pour les effacer avec leur morceau, il faut revenir au
 * chemin. Une adresse d'une autre forme — pochette hebergee ailleurs — ne
 * donne rien, et n'est donc pas effacee.
 */
export function cheminDepuisAdresse(adresse) {
  const chemin = String(adresse || "").replace(/^\/api\/asset\//, "");
  return cheminValide(chemin) ? chemin : null;
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
  const { url, jeton } = await stockage().depot(chemin);

  return { chemin, url, jeton };
}

/** Adresse de lecture, valable quelques minutes. */
export async function adresseDeLecture(chemin, { telechargement = null } = {}) {
  exigerChemin(chemin);

  return stockage().lecture(chemin, telechargement);
}

/** Depot cote serveur, pour le catalogue de demonstration et les tests. */
export async function deposerObjet(chemin, contenu, mime) {
  exigerChemin(chemin);

  await stockage().deposer(chemin, contenu, mime);
  return chemin;
}

export async function supprimerObjet(chemin) {
  if (!chemin || !cheminValide(chemin)) return;
  await stockage().supprimer([chemin]);
}

export async function supprimerObjets(chemins) {
  const valides = (chemins || []).filter(cheminValide);
  if (!valides.length) return;
  await stockage().supprimer(valides);
}

/**
 * Nettoyage au mieux, apres une suppression deja acquise.
 *
 * Les lignes sont parties de la base : un stockage injoignable ne doit pas
 * faire repondre echec a une operation irreversible qui a reussi, sinon
 * l'appelant recommence dans le vide. Le probleme est journalise, les objets
 * restent orphelins.
 */
export async function nettoyerObjets(chemins) {
  try {
    await supprimerObjets(chemins);
    return true;
  } catch (erreur) {
    console.error("Nettoyage du stockage impossible :", erreur.message, chemins);
    return false;
  }
}
