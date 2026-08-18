import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <p className="text-6xl font-black text-faso-gold">404</p>
      <h1 className="text-xl font-bold text-white">Cette page n&apos;existe pas</h1>
      <p className="max-w-md text-sm text-white/50">
        Le lien est peut-etre ancien, ou le morceau a ete retire par son artiste.
      </p>
      <Link href="/" className="btn-primary">
        Retour a l&apos;accueil
      </Link>
    </div>
  );
}
