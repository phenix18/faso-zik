import Link from "next/link";

export const metadata = { title: "Hors connexion" };

export default function HorsLignePage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <p className="text-5xl">📡</p>
      <h1 className="text-xl font-bold text-white">Pas de reseau</h1>
      <p className="max-w-md text-sm text-white/50">
        FASO-ZIK ne joint pas le serveur pour l&apos;instant. Les pages deja consultees restent
        accessibles ; la lecture, elle, demande une connexion.
      </p>
      <Link href="/" className="btn-primary">
        Reessayer
      </Link>
    </div>
  );
}
