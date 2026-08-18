/**
 * Verifie que chaque icone importee depuis react-icons existe reellement.
 *
 * Un nom d'icone errone ne casse pas la compilation : le composant vaut
 * undefined et React ne plante qu'au moment ou l'element est rendu, parfois
 * dans une branche rare. Ce controle rattrape l'erreur avant la mise en ligne.
 *
 *   node scripts/check-icons.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ROOT = path.join(process.cwd(), "src");
const PATTERN = /import\s*\{([^}]+)\}\s*from\s*"(react-icons\/[a-z0-9]+)"/gs;

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) return walk(full);
    return /\.(js|jsx)$/.test(entry.name) ? [full] : [];
  });
}

const problems = [];
for (const file of walk(ROOT)) {
  const source = fs.readFileSync(file, "utf8");
  for (const match of source.matchAll(PATTERN)) {
    const pack = require(match[2]);
    for (const raw of match[1].split(",")) {
      const name = raw.trim();
      if (name && !pack[name]) {
        problems.push(`${path.relative(process.cwd(), file)} : ${name} absent de ${match[2]}`);
      }
    }
  }
}

if (problems.length) {
  console.error("Icones introuvables :");
  problems.forEach((line) => console.error(`  - ${line}`));
  process.exit(1);
}
console.log("Toutes les icones importees existent.");
