import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { resolveMedia } from "@/lib/storage";

const run = promisify(execFile);
const FFMPEG = process.env.FFMPEG_PATH || "ffmpeg";

/**
 * Detection du tempo.
 *
 * La platine a besoin d'un BPM pour caler les boucles et aligner deux
 * morceaux. Le demander a l'artiste marche mal : le champ reste vide, ou porte
 * une valeur approximative. On le mesure donc a partir du signal.
 *
 * Methode : enveloppe d'energie, flux spectral simplifie (les seules montees
 * d'energie comptent, une decrue n'est pas une frappe), puis autocorrelation
 * de cette fonction d'attaques. Le pic le plus marque donne la periode entre
 * frappes.
 */

const TAUX = 11025; // suffisant pour une enveloppe rythmique
const FENETRE = 128; // environ 11,6 ms par pas
const BPM_MIN = 60;
const BPM_MAX = 190;
// Tempo de reference de la perception humaine : a support egal, un auditeur
// entend le tempo le plus proche de cette valeur. L'etalement a ete calibre
// sur quatorze signaux de reference (voir tests/bpm.test.js) : plus etroit, il
// tire les morceaux rapides vers le milieu ; plus large, il ne redresse plus
// les erreurs d'octave.
const BPM_PREFERE = 120;
const ETALEMENT = 90;

/** Decode le fichier en PCM mono 16 bits, sans passer par le disque. */
async function pcmMono(relativePath) {
  const { stdout } = await run(
    FFMPEG,
    [
      "-nostdin", "-v", "error",
      "-i", resolveMedia(relativePath),
      // Au-dela de trois minutes, le tempo ne change plus assez pour justifier
      // le decodage complet d'un long fichier.
      "-t", "180",
      "-ac", "1",
      "-ar", String(TAUX),
      "-f", "s16le",
      "-",
    ],
    { encoding: "buffer", maxBuffer: 64 * 1024 * 1024 },
  );
  return stdout;
}

/** Energie par fenetre : la forme grossiere du morceau dans le temps. */
function enveloppe(pcm) {
  const echantillons = Math.floor(pcm.length / 2);
  const pas = Math.floor(echantillons / FENETRE);
  const valeurs = new Float64Array(pas);

  for (let index = 0; index < pas; index += 1) {
    let somme = 0;
    const debut = index * FENETRE;
    for (let decalage = 0; decalage < FENETRE; decalage += 1) {
      const valeur = pcm.readInt16LE((debut + decalage) * 2) / 32768;
      somme += valeur * valeur;
    }
    valeurs[index] = Math.sqrt(somme / FENETRE);
  }
  return valeurs;
}

/** Fonction d'attaques : seules les montees d'energie comptent. */
function attaques(valeurs) {
  const flux = new Float64Array(valeurs.length);
  for (let index = 1; index < valeurs.length; index += 1) {
    flux[index] = Math.max(valeurs[index] - valeurs[index - 1], 0);
  }

  // Retrait de la moyenne : sans cela, l'autocorrelation est dominee par le
  // niveau general du morceau et non par sa periodicite.
  const moyenne = flux.reduce((somme, valeur) => somme + valeur, 0) / (flux.length || 1);
  for (let index = 0; index < flux.length; index += 1) {
    flux[index] = Math.max(flux[index] - moyenne, 0);
  }
  return flux;
}

/** Autocorrelation de la fonction d'attaques, normalisee par le recouvrement. */
function autocorrelation(flux, decalage) {
  const entier = Math.round(decalage);
  if (entier <= 0 || entier >= flux.length) return 0;

  let score = 0;
  for (let index = 0; index + entier < flux.length; index += 1) {
    score += flux[index] * flux[index + entier];
  }
  return score / (flux.length - entier);
}

/**
 * Un tempo hors de la plage cherchee est ramene par doublements successifs.
 * On ne force rien a l'interieur de la plage : ce serait transformer un
 * morceau lent a 72 en 144.
 */
function corrigerOctave(bpm) {
  let valeur = bpm;
  while (valeur < BPM_MIN) valeur *= 2;
  while (valeur > BPM_MAX) valeur /= 2;
  return valeur;
}

/**
 * Une frappe sur deux plus faible que l'autre trahit une mesure deux fois plus
 * longue : l'autocorrelation a trouve l'intervalle entre frappes, pas le
 * tempo. C'est le cas classique du contretemps, ou la caisse claire s'intercale
 * entre deux coups de grosse caisse.
 *
 * On mesure l'energie des attaques une position sur deux, a partir de la phase
 * la mieux alignee. Si les deux series different nettement, la periode reelle
 * vaut le double.
 */
function periodeDoublee(flux, decalage) {
  const positions = (depart, pas) => {
    let somme = 0;
    let nombre = 0;
    for (let index = depart; index < flux.length; index += pas) {
      somme += flux[Math.round(index)];
      nombre += 1;
    }
    return nombre ? somme / nombre : 0;
  };

  // Phase la plus energique : celle ou tombent les frappes.
  let meilleurePhase = 0;
  let meilleureEnergie = -1;
  for (let phase = 0; phase < decalage; phase += 1) {
    const energie = positions(phase, decalage);
    if (energie > meilleureEnergie) {
      meilleureEnergie = energie;
      meilleurePhase = phase;
    }
  }

  const paires = positions(meilleurePhase, decalage * 2);
  const impaires = positions(meilleurePhase + decalage, decalage * 2);
  const fort = Math.max(paires, impaires);
  const faible = Math.min(paires, impaires);
  if (faible <= 0) return false;

  return fort / faible > 1.4;
}

export async function detecterBpm(relativePath) {
  const pcm = await pcmMono(relativePath);
  if (pcm.length < TAUX * 4) return null; // moins de deux secondes exploitables

  const flux = attaques(enveloppe(pcm));
  const parSeconde = TAUX / FENETRE;
  const decalageMin = Math.floor((60 / BPM_MAX) * parSeconde);
  const decalageMax = Math.ceil((60 / BPM_MIN) * parSeconde);
  if (decalageMax >= flux.length) return null;

  let meilleurDecalage = 0;
  let meilleurScore = 0;

  for (let decalage = decalageMin; decalage <= decalageMax; decalage += 1) {
    // Une autocorrelation favorise mecaniquement les longues periodes : la
    // structure d'une mesure y ressort souvent plus que le temps lui-meme.
    // Le poids perceptif retablit l'equilibre sans jamais ecraser un pic net.
    const bpm = (60 * parSeconde) / decalage;
    const ecart = (bpm - BPM_PREFERE) / ETALEMENT;
    const score = autocorrelation(flux, decalage) * Math.exp(-0.5 * ecart * ecart);

    if (score > meilleurScore) {
      meilleurScore = score;
      meilleurDecalage = decalage;
    }
  }

  if (!meilleurDecalage || meilleurScore <= 0) return null;

  // Barycentre autour du pic : la resolution d'un pas vaut environ 11 ms,
  // trop grossiere pour un tempo au dixieme pres.
  let numerateur = 0;
  let denominateur = 0;
  for (let decalage = meilleurDecalage - 1; decalage <= meilleurDecalage + 1; decalage += 1) {
    if (decalage < decalageMin || decalage > decalageMax) continue;
    const score = autocorrelation(flux, decalage);
    numerateur += decalage * score;
    denominateur += score;
  }

  let decalageAffine = denominateur ? numerateur / denominateur : meilleurDecalage;

  // Frappes d'intensites alternees : le tempo est deux fois plus lent. Deux
  // conditions, car le seul test d'alternance se declenche parfois sur une
  // variation harmonique — la periode doublee doit aussi apparaitre dans
  // l'autocorrelation.
  const doublePlausible =
    decalageAffine * 2 <= decalageMax &&
    autocorrelation(flux, meilleurDecalage * 2) >= 0.6 * meilleurScore;

  if (doublePlausible && periodeDoublee(flux, meilleurDecalage)) {
    decalageAffine *= 2;
  }

  return Math.round(corrigerOctave((60 * parSeconde) / decalageAffine) * 10) / 10;
}
