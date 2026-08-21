/**
 * Retire les donnees locales de la sortie autonome.
 *
 * Le traceur de Next copie tout ce qu'il croit utile a l'execution, base
 * SQLite et fichiers audio compris : sans ce nettoyage, `npm run build` sur un
 * poste de developpement produit une sortie qui embarque le catalogue local.
 *
 * L'option `outputFileTracingExcludes` reglerait le probleme sur le papier,
 * mais dans Next 14.2 elle fait sur-exclure le traceur, qui laisse alors de
 * cote des modules internes dont le serveur a besoin au demarrage.
 */
import fs from "node:fs";
import path from "node:path";

const STANDALONE = path.join(process.cwd(), ".next", "standalone");
if (!fs.existsSync(STANDALONE)) process.exit(0);

for (const nom of ["data", "storage"]) {
  const cible = path.join(STANDALONE, nom);
  if (fs.existsSync(cible)) {
    fs.rmSync(cible, { recursive: true, force: true });
    console.log(`Sortie autonome : ${nom}/ retire.`);
  }
}
