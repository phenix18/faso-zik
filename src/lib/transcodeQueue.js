import { getDb } from "@/lib/db";
import { getTrackRow, setTranscodeResult } from "@/lib/repo/tracks";
import { afficheVideo, analyser, ffmpegDisponible, versionEcouteAudio, versionsHls } from "@/lib/transcode";

/**
 * File de transcodage.
 *
 * Un seul travail a la fois : sur le petit serveur vise, deux encodages video
 * simultanes rendraient le site injoignable pendant plusieurs minutes. Le
 * depot repond donc tout de suite, le morceau reste ecoutable dans sa version
 * d'origine, et la version allegee le remplace des qu'elle est prete.
 *
 * La file vit en memoire : un redemarrage en cours de route laisserait des
 * morceaux bloques en "attente", d'ou la reprise au premier acces.
 */

const file = [];
let enCours = false;
let repriseFaite = false;

export function planifierTranscodage(trackId) {
  getDb().prepare("UPDATE tracks SET transcode_status = 'attente' WHERE id = ?").run(trackId);
  file.push(trackId);
  lancerSuivant();
}

/**
 * Remet en file ce qu'un arret a laisse en plan.
 *
 * Appelee depuis la mise en page racine, donc a la premiere page servie apres
 * un demarrage. Le fichier `instrumentation.js` serait l'endroit naturel, mais
 * Next le compile aussi pour le runtime Edge, ou le pilote SQLite n'existe pas.
 * Le drapeau rend les appels suivants gratuits.
 */
export function reprendreTranscodagesInacheves() {
  if (repriseFaite) return 0;
  repriseFaite = true;

  const restants = getDb()
    .prepare("SELECT id FROM tracks WHERE transcode_status IN ('attente', 'encours')")
    .all();

  for (const { id } of restants) {
    if (!file.includes(id)) file.push(id);
  }
  if (restants.length) lancerSuivant();
  return restants.length;
}

async function lancerSuivant() {
  if (enCours) return;
  const trackId = file.shift();
  if (!trackId) return;

  enCours = true;
  try {
    await traiter(trackId);
  } catch (erreur) {
    console.error(`Transcodage de ${trackId} : ${erreur.message}`);
    try {
      setTranscodeResult(trackId, { status: "echec" });
    } catch {
      // Le morceau a pu etre supprime entre-temps : rien a rattraper.
    }
  } finally {
    enCours = false;
    if (file.length) lancerSuivant();
  }
}

async function traiter(trackId) {
  const row = getTrackRow(trackId);
  if (!row) return;

  if (!(await ffmpegDisponible())) {
    setTranscodeResult(trackId, { status: "absent" });
    return;
  }

  getDb().prepare("UPDATE tracks SET transcode_status = 'encours' WHERE id = ?").run(trackId);

  const info = await analyser(row.media_path);
  const duree = info?.duration || 0;

  if (row.kind === "video") {
    const hls = await versionsHls(row.media_path, { hauteurSource: info?.height });
    // Pochette prise dans le clip, seulement si l'artiste n'en a pas fourni.
    const affiche = row.cover_url ? null : await afficheVideo(row.media_path);
    setTranscodeResult(trackId, {
      status: "pret",
      hlsPath: hls.relativePath,
      // Pas de preview_path pour un clip : c'est le HLS qui sert la lecture.
      // Seul le poids est enregistre, pour afficher ce qui transite vraiment.
      preview: { size: hls.poids360 },
      coverUrl: affiche ? `/api/asset/${affiche.split("\\").join("/")}` : null,
      duration: duree,
    });
    return;
  }

  const preview = await versionEcouteAudio(row.media_path);
  setTranscodeResult(trackId, { status: "pret", preview, duration: duree });
}

/** Etat de la file, affiche dans le studio. */
export function etatFile() {
  return { enAttente: file.length, enCours };
}
