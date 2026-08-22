/**
 * Promeut un compte existant au rang d'administrateur.
 *
 * Volontairement en ligne de commande : aucune page du site ne permet de
 * s'attribuer ce role, ni de l'attribuer a un autre.
 *
 *   npm run admin -- adresse@exemple.bf
 */
import { execute, fermerDb, unique } from "../src/lib/db/index.js";

const email = process.argv[2]?.toLowerCase().trim();
if (!email) {
  console.error("Adresse e-mail attendue : npm run admin -- adresse@exemple.bf");
  process.exit(1);
}

// La connexion est fermee avant de sortir : `process.exit` couperait le
// processus sans laisser au pilote le temps de rendre la main.
async function promouvoir() {
  const compte = await unique("SELECT id, name, role FROM users WHERE email = $1", [email]);
  if (!compte) {
    console.error(`Aucun compte avec l'adresse ${email}.`);
    return 1;
  }

  await execute("UPDATE users SET role = 'admin' WHERE id = $1", [compte.id]);
  console.log(`${compte.name} (${email}) est desormais administrateur.`);
  console.log("La session en cours doit etre rouverte pour que le role prenne effet.");
  return 0;
}

let code = 1;
try {
  code = await promouvoir();
} catch (erreur) {
  console.error(erreur.message);
} finally {
  await fermerDb();
}
process.exitCode = code;
