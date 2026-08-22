import { detecterBpm } from "@/lib/navigateur/tempo";

/**
 * Preparation d'un depot, dans le navigateur.
 *
 * Le fichier depose n'est pas celui qu'on diffuse : l'original part au
 * stockage pour le telechargement autorise, et une version MP3 128 kbit/s est
 * fabriquee ici pour l'ecoute. Faire ce travail sur le poste de l'artiste
 * evite un serveur de transcodage, et allege ce qui transite ensuite vers
 * chaque auditeur.
 *
 * Le decodage sert aussi a mesurer la duree et le tempo, sans cout
 * supplementaire.
 */

const DEBIT = 128;
const TAUX_CIBLE = 44100;

/** Rend le signal mono en moyennant les canaux : un MP3 stereo double le poids. */
function melangerEnMono(buffer) {
  const canaux = buffer.numberOfChannels;
  if (canaux === 1) return buffer.getChannelData(0);

  const gauche = buffer.getChannelData(0);
  const droite = buffer.getChannelData(1);
  const melange = new Float32Array(gauche.length);
  for (let index = 0; index < gauche.length; index += 1) {
    melange[index] = (gauche[index] + droite[index]) / 2;
  }
  return melange;
}

function versEntiers16(flottants) {
  const entiers = new Int16Array(flottants.length);
  for (let index = 0; index < flottants.length; index += 1) {
    const valeur = Math.max(-1, Math.min(1, flottants[index]));
    entiers[index] = valeur < 0 ? valeur * 0x8000 : valeur * 0x7fff;
  }
  return entiers;
}

/**
 * Decode, mesure et encode.
 *
 * @param {File} fichier
 * @param {(etape: string, avancement: number) => void} surAvancement
 */
export async function preparerAudio(fichier, surAvancement = () => {}) {
  surAvancement("decodage", 0);

  const ContexteAudio = window.AudioContext || window.webkitAudioContext;
  const contexte = new ContexteAudio();
  let buffer;
  try {
    buffer = await contexte.decodeAudioData(await fichier.arrayBuffer());
  } finally {
    contexte.close();
  }

  const duree = Math.round(buffer.duration);
  surAvancement("analyse", 0.2);

  let bpm = null;
  try {
    bpm = detecterBpm(buffer);
  } catch {
    // Un tempo introuvable n'empeche rien : le champ reste vide.
  }

  surAvancement("encodage", 0.3);
  const { Mp3Encoder } = await import("@breezystack/lamejs");
  const encodeur = new Mp3Encoder(1, buffer.sampleRate || TAUX_CIBLE, DEBIT);

  const echantillons = versEntiers16(melangerEnMono(buffer));
  const morceaux = [];
  const taille = 1152 * 20; // multiple de la trame MP3

  for (let debut = 0; debut < echantillons.length; debut += taille) {
    const bloc = encodeur.encodeBuffer(echantillons.subarray(debut, debut + taille));
    if (bloc.length) morceaux.push(bloc);

    // Laisse respirer l'interface : sans cela, un morceau long fige la page.
    if (debut % (taille * 10) === 0) {
      surAvancement("encodage", 0.3 + 0.6 * (debut / echantillons.length));
      await new Promise((resoudre) => setTimeout(resoudre, 0));
    }
  }

  const fin = encodeur.flush();
  if (fin.length) morceaux.push(fin);

  surAvancement("encodage", 1);
  return {
    duree,
    bpm,
    ecoute: new Blob(morceaux, { type: "audio/mpeg" }),
  };
}

/** Duree d'un clip, lue sans le decoder entierement. */
export function dureeVideo(fichier) {
  return new Promise((resoudre) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(video.src);
      resoudre(Math.round(video.duration) || 0);
    };
    video.onerror = () => resoudre(0);
    video.src = URL.createObjectURL(fichier);
  });
}

/** Envoi direct au stockage, avec avancement. */
export function envoyerFichier(url, fichier, surAvancement = () => {}) {
  return new Promise((resoudre, rejeter) => {
    const requete = new XMLHttpRequest();
    requete.open("PUT", url);
    requete.setRequestHeader("content-type", fichier.type || "application/octet-stream");

    requete.upload.onprogress = (evenement) => {
      if (evenement.lengthComputable) surAvancement(evenement.loaded / evenement.total);
    };
    requete.onload = () =>
      requete.status >= 200 && requete.status < 300
        ? resoudre()
        : rejeter(new Error(`Envoi refuse (${requete.status}).`));
    requete.onerror = () => rejeter(new Error("Envoi interrompu."));

    requete.send(fichier);
  });
}
