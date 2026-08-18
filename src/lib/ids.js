import crypto from "node:crypto";

export function newId(prefix = "") {
  const id = crypto.randomUUID().replace(/-/g, "").slice(0, 20);
  return prefix ? `${prefix}_${id}` : id;
}

/** Transforme un titre en identifiant d'URL lisible ("Faso Denya" -> "faso-denya"). */
export function slugify(value) {
  return (
    String(value || "")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "sans-titre"
  );
}
