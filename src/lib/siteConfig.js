/** Constantes editoriales du site, surchargeables par l'environnement. */

export const SITE_NAME = "FASO-ZIK";
export const SITE_TAGLINE = "faso musique";
export const CONTACT_RIGHTS =
  process.env.NEXT_PUBLIC_CONTACT_RIGHTS || "droits@faso-zik.bf";
export const CONTACT_GENERAL =
  process.env.NEXT_PUBLIC_CONTACT_GENERAL || "contact@faso-zik.bf";
export const DELAY_TAKEDOWN_HOURS = 72;
