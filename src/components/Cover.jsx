"use client";

const PALETTE = [
  "from-faso-red/70 to-black",
  "from-faso-green/70 to-black",
  "from-faso-gold/60 to-black",
  "from-purple-600/60 to-black",
  "from-sky-600/60 to-black",
];

/** Pochette du morceau, avec repli colore deterministe quand il n'y en a pas. */
export default function Cover({ src, alt, className = "", rounded = "rounded-lg" }) {
  if (src) {
    return (
      <img
        src={src}
        alt={alt || ""}
        loading="lazy"
        className={`h-full w-full object-cover ${rounded} ${className}`}
      />
    );
  }

  const label = (alt || "?").trim();
  const seed = label.charCodeAt(0) + label.length;
  const gradient = PALETTE[seed % PALETTE.length];

  return (
    <div
      className={`flex h-full w-full items-center justify-center bg-gradient-to-br ${gradient} ${rounded} ${className}`}
      aria-hidden="true"
    >
      <span className="text-lg font-black uppercase tracking-tight text-white/85">
        {label.slice(0, 2)}
      </span>
    </div>
  );
}
