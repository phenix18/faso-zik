/**
 * La construction ne doit dependre d'aucune variable d'environnement.
 *
 * NextAuth lit NEXTAUTH_URL au chargement de son module, donc pendant le
 * prerendu. Faute de valeur il se rabat sur VERCEL_URL, que Vercel laisse vide
 * pendant la construction : `??` ne rattrape pas la chaine vide et
 * `new URL("")` faisait echouer tout le build. Un `.env.local` en poste de
 * travail et une variable posee dans l'integration continue avaient masque le
 * defaut jusqu'au premier deploiement.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

test("une adresse de session valide existe meme sans environnement", () => {
  const memoire = { url: process.env.NEXTAUTH_URL, vercel: process.env.VERCEL_URL };
  delete process.env.NEXTAUTH_URL;
  process.env.VERCEL_URL = ""; // exactement ce que fait Vercel a la construction

  try {
    createRequire(import.meta.url)("../next.config.js");
    assert.doesNotThrow(
      () => new URL(process.env.NEXTAUTH_URL),
      `adresse inutilisable : ${JSON.stringify(process.env.NEXTAUTH_URL)}`,
    );
  } finally {
    if (memoire.url === undefined) delete process.env.NEXTAUTH_URL;
    else process.env.NEXTAUTH_URL = memoire.url;
    if (memoire.vercel === undefined) delete process.env.VERCEL_URL;
    else process.env.VERCEL_URL = memoire.vercel;
  }
});

test("l'adresse de deploiement sert de repli quand elle existe", () => {
  const memoire = { url: process.env.NEXTAUTH_URL, vercel: process.env.VERCEL_URL };
  delete process.env.NEXTAUTH_URL;
  process.env.VERCEL_URL = "faso-zik-essai.vercel.app";

  try {
    const require = createRequire(import.meta.url);
    delete require.cache[require.resolve("../next.config.js")];
    require("../next.config.js");
    assert.equal(process.env.NEXTAUTH_URL, "https://faso-zik-essai.vercel.app");
  } finally {
    if (memoire.url === undefined) delete process.env.NEXTAUTH_URL;
    else process.env.NEXTAUTH_URL = memoire.url;
    if (memoire.vercel === undefined) delete process.env.VERCEL_URL;
    else process.env.VERCEL_URL = memoire.vercel;
  }
});
