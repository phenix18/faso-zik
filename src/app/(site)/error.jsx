"use client";

export default function Error({ error, reset }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <h1 className="text-xl font-bold text-white">Une erreur est survenue</h1>
      <p className="max-w-md text-sm text-white/50">{error?.message || "Reessayez dans un instant."}</p>
      <button type="button" onClick={reset} className="btn-primary">
        Reessayer
      </button>
    </div>
  );
}
