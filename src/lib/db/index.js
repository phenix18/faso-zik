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

  // PGlite en production serait pire qu'une panne : sans DATABASE_URL, chaque
  // instance ouvrirait sa propre base vide, en memoire. Le site aurait l'air de
  // fonctionner tout en perdant les comptes et le catalogue a chaque requete.
  // Un refus franc vaut mieux qu'une perte silencieuse.
  if (process.env.NODE_ENV === "production" && process.env.PGLITE_EN_PRODUCTION !== "oui") {
    throw new Error(
      "DATABASE_URL absent : renseignez une base PostgreSQL. " +
        "La base en memoire ne conserve rien et n'est pas partagee entre les instances.",
    );
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

/**
 * Deux instances ont voulu creer le schema en meme temps.
 *
 * `CREATE TABLE IF NOT EXISTS` n'est pas atomique face a un createur
 * concurrent : les deux constatent l'absence, puis se disputent la meme ligne
 * du catalogue. Le perdant recoit une violation d'unicite — qui signifie que
 * l'objet existe, donc exactement ce qu'on voulait.
 */
function estCollisionDeCreation(erreur) {
  // 23505 unicite (pg_type), 42P07 relation deja presente, 42710 objet duplique.
  return ["23505", "42P07", "42710"].includes(erreur?.code);
}

/**
 * Applique le schema, en serialisant les instances concurrentes.
 *
 * Sur une plateforme sans serveur, la premiere vague de trafic reveille
 * plusieurs instances a la seconde pres, et chacune applique le schema de son
 * cote. Un verrou consultatif les met a la file ; la tolerance a la collision
 * reste par-dessus, pour le cas ou le verrou ne serait pas obtenu.
 */
async function appliquerSchema(base) {
  // Entier arbitraire mais stable : c'est le nom du verrou.
  const CLE = 4185220001;
  const verrouillable = base.type === "postgres";

  if (verrouillable) await base.query("SELECT pg_advisory_lock($1)", [CLE]);
  try {
    await base.exec(schema);
  } catch (erreur) {
    if (!estCollisionDeCreation(erreur)) throw erreur;
  } finally {
    if (verrouillable) await base.query("SELECT pg_advisory_unlock($1)", [CLE]);
  }
}

/**
 * Ouvre la connexion et applique le schema, une seule fois par processus.
 *
 * L'ouverture en cours est mise de cote pour que deux requetes simultanees
 * n'ouvrent pas deux connexions. Un echec, lui, ne doit pas rester en memoire :
 * une base momentanement injoignable condamnerait sinon l'instance jusqu'a son
 * arret, chaque appel suivant recevant l'erreur de la premiere tentative.
 */
export async function getDb() {
  if (connexion) return connexion;
  if (!preparation) {
    preparation = (async () => {
      const base = await ouvrir();
      await appliquerSchema(base);
      connexion = base;
      return base;
    })().catch((erreur) => {
      preparation = null;
      throw erreur;
    });
  }
  return preparation;
}

/** Expose pour les tests : la reconnaissance d'une collision de creation. */
export const _estCollisionDeCreation = estCollisionDeCreation;

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
