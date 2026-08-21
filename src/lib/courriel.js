import { SITE_NAME } from "@/lib/siteConfig";

/**
 * Envoi de courriels.
 *
 * Un seul usage pour l'instant : le lien de reinitialisation de mot de passe.
 * Sans SMTP configure, l'envoi echoue franchement au lieu de faire croire a un
 * courriel parti — un utilisateur qui attend un message qui n'arrivera jamais
 * est pire qu'un message d'erreur.
 */

const HOTE = process.env.SMTP_HOTE;
const PORT = Number(process.env.SMTP_PORT || 587);
const UTILISATEUR = process.env.SMTP_UTILISATEUR;
const MOT_DE_PASSE = process.env.SMTP_MOT_DE_PASSE;
const EXPEDITEUR = process.env.SMTP_EXPEDITEUR || UTILISATEUR;

export function courrielConfigure() {
  return !!(HOTE && EXPEDITEUR);
}

async function transport() {
  const { createTransport } = await import("nodemailer");
  return createTransport({
    host: HOTE,
    port: PORT,
    // 465 est le port du TLS implicite ; les autres passent par STARTTLS.
    secure: PORT === 465,
    auth: UTILISATEUR ? { user: UTILISATEUR, pass: MOT_DE_PASSE } : undefined,
  });
}

export async function envoyerLienReinitialisation({ destinataire, nom, lien, dureeMinutes }) {
  if (!courrielConfigure()) {
    throw new Error("L'envoi de courriels n'est pas configure sur ce site.");
  }

  const texte = [
    `Bonjour ${nom},`,
    "",
    `Vous avez demande a reinitialiser votre mot de passe ${SITE_NAME}.`,
    "Ouvrez ce lien pour en choisir un nouveau :",
    lien,
    "",
    `Ce lien est valable ${dureeMinutes} minutes et ne sert qu'une fois.`,
    "Si vous n'etes pas a l'origine de cette demande, ignorez ce message :",
    "votre mot de passe actuel reste valable.",
    "",
    SITE_NAME,
  ].join("\n");

  await (await transport()).sendMail({
    from: `${SITE_NAME} <${EXPEDITEUR}>`,
    to: destinataire,
    subject: `Reinitialiser votre mot de passe ${SITE_NAME}`,
    text: texte,
  });
}
