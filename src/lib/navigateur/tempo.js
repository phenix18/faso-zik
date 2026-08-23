/**
 * Mesure du tempo, dans le navigateur.
 *
 * Meme methode qu'avant, mais sur un AudioBuffer plutot que sur la sortie de
 * ffmpeg : enveloppe d'energie, fonction d'attaques, autocorrelation, avec une
 * ponderation perceptive et un test d'alternance d'intensite contre les
 * erreurs d'octave. Le fichier etant deja decode pour l'encodage MP3, la
 * mesure ne coute presque rien de plus.
 */

const FENETRE = 128;
const BPM_MIN = 60;
const BPM_MAX = 190;
const BPM_PREFERE = 120;
const ETALEMENT = 90;

function autocorrelation(flux, decalage) {
  const entier = Math.round(decalage);
  if (entier <= 0 || entier >= flux.length) return 0;

  let score = 0;
  for (let index = 0; index + entier < flux.length; index += 1) {
    score += flux[index] * flux[index + entier];
  }
  return score / (flux.length - entier);
}

function corrigerOctave(bpm) {
  let valeur = bpm;
  while (valeur < BPM_MIN) valeur *= 2;
  while (valeur > BPM_MAX) valeur /= 2;
  return valeur;
}

/**
 * Une frappe sur deux plus faible que l'autre trahit une mesure deux fois plus
 * longue : l'autocorrelation a trouve l'intervalle entre frappes, pas le tempo.
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

/** @param {AudioBuffer} buffer @returns {number|null} tempo au dixieme */
export function detecterBpm(buffer) {
  const canal = buffer.getChannelData(0);
  const taux = buffer.sampleRate;
  // Au-dela de trois minutes, le tempo ne change plus assez pour justifier
  // d'analyser davantage.
  const total = Math.min(canal.length, taux * 180);
  if (total < taux * 4) return null;

  const pas = Math.floor(total / FENETRE);
  const enveloppe = new Float64Array(pas);
  for (let index = 0; index < pas; index += 1) {
    let somme = 0;
    const debut = index * FENETRE;
    for (let decalage = 0; decalage < FENETRE; decalage += 1) {
      const valeur = canal[debut + decalage] || 0;
      somme += valeur * valeur;
    }
    enveloppe[index] = Math.sqrt(somme / FENETRE);
  }

  // Seules les montees d'energie comptent : une decrue n'est pas une frappe.
  const flux = new Float64Array(pas);
  for (let index = 1; index < pas; index += 1) {
    flux[index] = Math.max(enveloppe[index] - enveloppe[index - 1], 0);
  }
  const moyenne = flux.reduce((somme, valeur) => somme + valeur, 0) / (flux.length || 1);
  for (let index = 0; index < flux.length; index += 1) {
    flux[index] = Math.max(flux[index] - moyenne, 0);
  }

  const parSeconde = taux / FENETRE;
  const decalageMin = Math.floor((60 / BPM_MAX) * parSeconde);
  const decalageMax = Math.ceil((60 / BPM_MIN) * parSeconde);
  if (decalageMax >= flux.length) return null;

  let meilleurDecalage = 0;
  let meilleurScore = 0;
  for (let decalage = decalageMin; decalage <= decalageMax; decalage += 1) {
    // Une autocorrelation favorise les longues periodes : la structure d'une
    // mesure y ressort souvent plus que le temps lui-meme.
    const bpm = (60 * parSeconde) / decalage;
    const ecart = (bpm - BPM_PREFERE) / ETALEMENT;
    const score = autocorrelation(flux, decalage) * Math.exp(-0.5 * ecart * ecart);

    if (score > meilleurScore) {
      meilleurScore = score;
      meilleurDecalage = decalage;
    }
  }
  if (!meilleurDecalage || meilleurScore <= 0) return null;

  // Barycentre autour du pic : un pas vaut environ 11 ms, trop grossier pour
  // un tempo au dixieme pres.
  let numerateur = 0;
  let denominateur = 0;
  for (let decalage = meilleurDecalage - 1; decalage <= meilleurDecalage + 1; decalage += 1) {
    if (decalage < decalageMin || decalage > decalageMax) continue;
    const score = autocorrelation(flux, decalage);
    numerateur += decalage * score;
    denominateur += score;
  }

  let decalageAffine = denominateur ? numerateur / denominateur : meilleurDecalage;

  const doublePlausible =
    decalageAffine * 2 <= decalageMax &&
    autocorrelation(flux, meilleurDecalage * 2) >= 0.6 * autocorrelation(flux, meilleurDecalage);

  if (doublePlausible && periodeDoublee(flux, meilleurDecalage)) {
    decalageAffine *= 2;
  }

  return Math.round(corrigerOctave((60 * parSeconde) / decalageAffine) * 10) / 10;
}
