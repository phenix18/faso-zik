/**
 * Autorisations accordees par l'artiste, verifiees cote serveur.
 *
 * La regle du site : rien n'est telechargeable ni chargeable en platine par
 * defaut. C'est l'artiste qui ouvre chaque droit, morceau par morceau, depuis
 * son studio. Les composants d'interface se contentent de refleter ces
 * champs ; l'autorite reste ici, sur le serveur.
 */

export function canStream(track) {
  return !!track && !!track.allow_stream && !!track.published;
}

export function canDownload(track) {
  return canStream(track) && !!track.allow_download;
}

export function canUseInDj(track) {
  return canStream(track) && !!track.allow_dj;
}

export function ownsTrack(user, track) {
  if (!user || !track) return false;
  if (user.role === "admin") return true;
  return !!user.artistId && user.artistId === track.artist_id;
}

export const PERMISSION_LABELS = {
  stream: "Ecoute en ligne",
  download: "Telechargement autorise",
  dj: "Utilisable en platine DJ",
};
