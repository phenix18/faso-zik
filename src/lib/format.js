/** Formatage partage entre le serveur et le navigateur. */

export function formatDuration(seconds) {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

export function formatSize(bytes) {
  const value = Number(bytes) || 0;
  if (value < 1024) return `${value} o`;
  if (value < 1048576) return `${(value / 1024).toFixed(0)} Ko`;
  if (value < 1073741824) return `${(value / 1048576).toFixed(1)} Mo`;
  return `${(value / 1073741824).toFixed(2)} Go`;
}

export function formatCount(value) {
  const n = Number(value) || 0;
  if (n < 1000) return String(n);
  if (n < 1000000) return `${(n / 1000).toFixed(n < 10000 ? 1 : 0)} k`;
  return `${(n / 1000000).toFixed(1)} M`;
}

/** Montants en francs CFA : pas de decimales, espace insecable avant l'unite. */
export function formatCfa(montant) {
  const valeur = Math.round(Number(montant) || 0);
  return `${valeur.toLocaleString("fr-FR").replace(/\u202f/g, "\u00a0")}\u00a0F\u00a0CFA`;
}
