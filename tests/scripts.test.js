/**
 * Les scripts en ligne de commande vivent hors du bundler : rien ne resout
 * leurs imports a leur place. Un `@/...` ajoute dans une bibliotheque qu'ils
 * traversent les cassait sans que rien ne le signale — d'ou ces deux
 * verifications, qui les lancent pour de vrai et regardent ou ils s'arretent.
 */
import assert from "node:assert/strict";
import { exec } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const executer = promisify(exec);
const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { scripts } = JSON.parse(fs.readFileSync(path.join(RACINE, "package.json"), "utf8"));

// On rejoue la ligne de commande declaree dans package.json, celle que lancent
// l'exploitant et l'integration continue : c'est la qu'etait l'oubli.
async function lancer(nom, args = "") {
  try {
    const { stdout, stderr } = await executer(`${scripts[nom]} ${args}`, {
      cwd: RACINE,
      env: { ...process.env, DATABASE_URL: "", PGLITE_DIR: "" },
    });
    return { code: 0, stdout, stderr };
  } catch (erreur) {
    return { code: erreur.code, stdout: erreur.stdout || "", stderr: erreur.stderr || "" };
  }
}

test("le jeu de demonstration se charge et reclame le stockage", async () => {
  const { stderr } = await lancer("seed");

  assert.ok(!stderr.includes("ERR_MODULE_NOT_FOUND"), `import non resolu : ${stderr}`);
  assert.match(stderr, /Stockage non configure/);
});

test("la promotion d'administrateur atteint la base", async () => {
  const { code, stderr } = await lancer("admin", "inconnu@exemple.bf");

  assert.ok(!stderr.includes("ERR_MODULE_NOT_FOUND"), `import non resolu : ${stderr}`);
  // Le message ne peut venir que d'une requete reellement executee.
  assert.match(stderr, /Aucun compte avec l'adresse inconnu@exemple\.bf/);
  assert.equal(code, 1);
});

test("le controle d'installation atteint la base et nomme ce qui manque", async () => {
  const { code, stdout, stderr } = await lancer("verifier");

  assert.ok(!stderr.includes("ERR_MODULE_NOT_FOUND"), `import non resolu : ${stderr}`);
  // La connexion est reellement etablie : le compte de tables vient d'une requete.
  assert.match(stdout, /connexion etablie \(pglite\) — \d+ tables/);
  // Sans stockage ni secret de session, le controle doit refuser de conclure.
  assert.match(stdout, /point\(s\) bloquant\(s\)/);
  assert.equal(code, 1);
});
