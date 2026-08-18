import Link from "next/link";

export default function SectionHeader({ title, subtitle, href, linkLabel = "Tout voir" }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-4">
      <div>
        <h2 className="section-title">{title}</h2>
        {subtitle && <p className="text-xs text-white/40">{subtitle}</p>}
      </div>
      {href && (
        <Link href={href} className="shrink-0 text-xs font-semibold text-faso-gold hover:underline">
          {linkLabel}
        </Link>
      )}
    </div>
  );
}
