/**
 * Resout l'alias "@/..." utilise par Next.js, pour que les tests et les
 * scripts en ligne de commande importent les modules de l'application sans les
 * modifier. Le bundler ajoute aussi l'extension implicitement : on refait la
 * meme chose ici.
 */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const SRC = path.join(process.cwd(), "src");

function firstExisting(base) {
  const candidates = [base, `${base}.js`, `${base}.jsx`, path.join(base, "index.js")];
  return candidates.find((candidate) => {
    try {
      return fs.statSync(candidate).isFile();
    } catch {
      return false;
    }
  });
}

export function resolve(specifier, context, next) {
  if (!specifier.startsWith("@/")) return next(specifier, context);

  const resolved = firstExisting(path.join(SRC, specifier.slice(2)));
  if (!resolved) {
    throw new Error(`Alias non resolu : ${specifier}`);
  }
  return next(pathToFileURL(resolved).href, context);
}
