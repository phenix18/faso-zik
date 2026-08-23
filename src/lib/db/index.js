import { schema } from "@/lib/db/schema";

/**
 * Acces a la base PostgreSQL.
 *
 * Deux pilotes derriere la meme interface :
 *  - `postgres` quand DATABASE_URL est renseigne (Supabase, Neon, un Postgres
 *    a soi) ;
 *  - PGlite sinon, un PostgreSQL compile en WebAssembly qui tourne dans le
 *    processus. C'est ce qui permet de developper et de faire tourner les
 *    tests sans service exterieur, avec le meme dialecte SQL qu'en production
 *    — un Postgres imite par SQLite reservait trop de surprises.
 *
 * Toutes les fonctions sont asynchrones : c'est la seule facon de parler a un
 * serveur distant, et cela remonte jusqu'aux routes et aux pages.
 */

let connexion = null;
let preparation = null;

async function ouvrir() {
  const url = process.env.DATABASE_URL;

  if (url) {
    const { default: postgres } = await import("postgres");
    // Sur une plateforme sans serveur, chaque instance ouvre sa propre
    // connexion : on en garde une seule et on la laisse se fermer d'elle-meme.
    const sql = postgres(url, {
      max: Number(process.env.DATABASE_POOL || 1),
      idle_timeout: 20,
      connect_timeout: 15,
      prepare: false, // incompatible avec le pooler en mode transaction
    });

    return {
      type: "postgres",
      async query(texte, params) {
        return sql.unsafe(texte, params);
      },
      // Plusieurs instructions d'un coup : reserve au schema, sans parametres.
      async exec(texte) {
        return sql.unsafe(texte).simple();
      },
      async close() {
        await sql.end({ timeout: 5 });
      },
    };
  }

  const { PGlite } = await import("@electric-sql/pglite");
  const chemin = process.env.PGLITE_DIR || undefined; // en memoire par defaut
  const pglite = await PGlite.create(chemin);

  return {
    type: "pglite",
    async query(texte, params) {
      const resultat = await pglite.query(texte, params);
      const lignes = resultat.rows || [];
      lignes.count = resultat.affectedRows ?? lignes.length;
      return lignes;
    },
    async exec(texte) {
      return pglite.exec(texte);
    },
    async close() {
      await pglite.close();
    },
  };
}

/** Ouvre la connexion et applique le schema, une seule fois par processus. */
export async function getDb() {
  if (connexion) return connexion;
  if (!preparation) {
    preparation = (async () => {
      const base = await ouvrir();
      await base.exec(schema);
      connexion = base;
      return base;
    })();
  }
  return preparation;
}

/** Lignes d'une requete. Les parametres sont toujours lies, jamais concatenes. */
export async function query(texte, params = []) {
  const base = await getDb();
  return base.query(texte, params);
}

/** Premiere ligne, ou null. */
export async function unique(texte, params = []) {
  const lignes = await query(texte, params);
  return lignes[0] || null;
}

/** Nombre de lignes touchees par une ecriture. */
export async function execute(texte, params = []) {
  const resultat = await query(texte, params);
  return resultat.count ?? resultat.length ?? 0;
}

/**
 * Transaction.
 *
 * Le rappel recoit une fonction de requete liee a la transaction : tout ce
 * qu'il execute part avec elle si une erreur survient.
 */
export async function transaction(rappel) {
  const base = await getDb();
  await base.query("BEGIN", []);

  try {
    const resultat = await rappel((texte, params = []) => base.query(texte, params));
    await base.query("COMMIT", []);
    return resultat;
  } catch (erreur) {
    await base.query("ROLLBACK", []);
    throw erreur;
  }
}

/** Ferme la connexion : utile aux scripts et aux tests, jamais au serveur. */
export async function fermerDb() {
  if (!connexion) return;
  await connexion.close();
  connexion = null;
  preparation = null;
}
