/**
 * Controle d'installation, a passer avant d'ouvrir le site.
 *
 * Les identifiants d'une base et d'un stockage ne se verifient pas a l'oeil :
 * une cle recopiee de travers, un seau au mauvais nom ou une autorisation
 * oubliee ne se voient qu'au premier vrai appel. Ce script fait donc ces
 * appels — jusqu'a deposer un objet, le relire par une adresse signee et
 * l'effacer — et dit ce qui manque en clair.
 *
 *   npm run verifier
 */
import { query, fermerDb, getDb } from "@/lib/db";
import {
  FOURNISSEUR,
  SEAU,
  adresseDeLecture,
  deposerObjet,
  stockageConfigure,
  supprimerObjet,
} from "@/lib/storage";
import { courrielConfigure } from "@/lib/courriel";
import { fournisseurActif, PaiementIndisponible } from "@/lib/paiement";

const bloquants = [];
const reserves = [];

function ok(texte, detail = "") {
  console.log(`  ok      ${texte}${detail ? ` — ${detail}` : ""}`);
}

function echec(texte, remede) {
  console.log(`  ECHEC   ${texte}`);
  bloquants.push(remede);
}

function reserve(texte, remede) {
  console.log(`  reserve ${texte}`);
  reserves.push(remede);
}

console.log("\nBase de donnees");
try {
  const db = await getDb();
  await query("SELECT 1");
  const tables = await query(
    "SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema = 'public'",
  );
  ok(`connexion etablie (${db.type})`, `${tables[0].n} tables`);

  if (db.type === "pglite") {
    reserve(
      "base en memoire : tout disparait a l'arret du processus",
      "Renseignez DATABASE_URL avec une base PostgreSQL geree.",
    );
  } else if (!/6543|pooler/.test(process.env.DATABASE_URL || "")) {
    reserve(
      "la connexion ne semble pas passer par un pooler",
      "Sur une plateforme sans serveur, prenez l'adresse du pooler en mode transaction : les connexions y sont nombreuses et courtes.",
    );
  }
} catch (erreur) {
  echec(`connexion impossible : ${erreur.message}`, "Verifiez DATABASE_URL.");
}

console.log(`\nStockage des medias (${FOURNISSEUR})`);
if (!stockageConfigure()) {
  echec(
    "aucun identifiant de stockage",
    FOURNISSEUR === "s3"
      ? "Renseignez S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID et S3_SECRET_ACCESS_KEY."
      : "Renseignez SUPABASE_URL et SUPABASE_SERVICE_KEY.",
  );
} else {
  const temoin = `image/controle-${Date.now()}.png`;
  const contenu = Buffer.from("FASO-ZIK controle d'installation");
  let depose = false;

  try {
    await deposerObjet(temoin, contenu, "image/png");
    depose = true;
    ok("depot accepte", `seau ${SEAU}`);
  } catch (erreur) {
    echec(`depot refuse : ${erreur.message}`, "Verifiez le nom du seau et les droits de la cle.");
  }

  if (depose) {
    try {
      const adresse = await adresseDeLecture(temoin);
      const reponse = await fetch(adresse);
      const relu = Buffer.from(await reponse.arrayBuffer());

      if (reponse.ok && relu.equals(contenu)) {
        ok("adresse signee lisible, contenu identique");
      } else {
        echec(
          `relecture inattendue (${reponse.status}, ${relu.length} octets)`,
          "L'adresse signee ne rend pas le fichier depose : verifiez la region et le point d'entree.",
        );
      }
    } catch (erreur) {
      echec(`relecture impossible : ${erreur.message}`, "Verifiez que le stockage est joignable.");
    }

    try {
      await supprimerObjet(temoin);
      ok("suppression acceptee");
    } catch (erreur) {
      echec(
        `suppression refusee : ${erreur.message}`,
        "Sans droit de suppression, le stockage se remplira d'objets orphelins.",
      );
    }
  }

  if (FOURNISSEUR === "s3") {
    reserve(
      "regle CORS non verifiable depuis ici",
      `Le seau doit accepter PUT depuis ${process.env.NEXT_PUBLIC_SITE_URL || "votre domaine"} : les artistes deposent directement au stockage, et sans cette regle le navigateur refuse l'envoi avant de le tenter.`,
    );
  }
}

console.log("\nSessions");
const secret = process.env.NEXTAUTH_SECRET || "";
if (!secret) {
  echec("NEXTAUTH_SECRET absent", "Generez-le : openssl rand -base64 32");
} else if (secret.length < 32 || /changez/i.test(secret)) {
  echec(
    "NEXTAUTH_SECRET trop court ou laisse a sa valeur d'exemple",
    "Generez-le : openssl rand -base64 32",
  );
} else {
  ok("NEXTAUTH_SECRET renseigne");
}
if (process.env.NEXTAUTH_URL) ok("NEXTAUTH_URL renseigne", process.env.NEXTAUTH_URL);
else reserve("NEXTAUTH_URL absent", "Renseignez l'adresse publique du site.");

console.log("\nPaiement");
try {
  const fournisseur = fournisseurActif();
  ok(`fournisseur ${fournisseur.nom || process.env.PAIEMENT_FOURNISSEUR || "simulation"} actif`);
  if ((process.env.PAIEMENT_FOURNISSEUR || "simulation") === "simulation") {
    reserve(
      "fournisseur de simulation : l'acheteur declare lui-meme son paiement recu",
      "Configurez un vrai prestataire avant de vendre quoi que ce soit.",
    );
  }
} catch (erreur) {
  if (erreur instanceof PaiementIndisponible) {
    ok("paiement ferme", "les routes repondent 503, aucune vente possible");
  } else {
    echec(`fournisseur inutilisable : ${erreur.message}`, "Verifiez la configuration du paiement.");
  }
}

console.log("\nCourriel et contacts");
if (courrielConfigure()) ok("SMTP renseigne");
else
  reserve(
    "SMTP absent : la reinitialisation de mot de passe reste fermee",
    "Renseignez SMTP_HOTE, SMTP_UTILISATEUR et SMTP_MOT_DE_PASSE.",
  );

for (const [nom, valeur] of [
  ["NEXT_PUBLIC_SITE_URL", process.env.NEXT_PUBLIC_SITE_URL],
  ["NEXT_PUBLIC_CONTACT_RIGHTS", process.env.NEXT_PUBLIC_CONTACT_RIGHTS],
  ["NEXT_PUBLIC_CONTACT_GENERAL", process.env.NEXT_PUBLIC_CONTACT_GENERAL],
]) {
  if (valeur) ok(nom, valeur);
  else reserve(`${nom} absent`, `Renseignez ${nom}.`);
}

await fermerDb();

console.log("");
if (reserves.length) {
  console.log(`${reserves.length} reserve(s) :`);
  for (const r of reserves) console.log(`  - ${r}`);
  console.log("");
}
if (bloquants.length) {
  console.log(`${bloquants.length} point(s) bloquant(s) :`);
  for (const b of bloquants) console.log(`  - ${b}`);
  console.log("\nLe site ne fonctionnera pas en l'etat.\n");
  process.exitCode = 1;
} else {
  console.log("Rien de bloquant : le site peut etre ouvert.\n");
}
