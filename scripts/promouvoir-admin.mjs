/**
 * Promeut un compte existant au rang d'administrateur.
 *
 * Volontairement en ligne de commande : aucune page du site ne permet de
 * s'attribuer ce role, ni de l'attribuer a un autre.
 *
 *   npm run admin -- adresse@exemple.bf
 */
import { getDb } from "../src/lib/db.js";

const email = process.argv[2]?.toLowerCase().trim();
if (!email) {
  console.error("Adresse e-mail attendue : npm run admin -- adresse@exemple.bf");
  process.exit(1);
}

const db = getDb();
const compte = db.prepare("SELECT id, name, role FROM users WHERE email = ?").get(email);
if (!compte) {
  console.error(`Aucun compte avec l'adresse ${email}.`);
  process.exit(1);
}

db.prepare("UPDATE users SET role = 'admin' WHERE id = ?").run(compte.id);
console.log(`${compte.name} (${email}) est desormais administrateur.`);
console.log("La session en cours doit etre rouverte pour que le role prenne effet.");
