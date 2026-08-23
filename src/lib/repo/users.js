import bcrypt from "bcryptjs";
import { execute, transaction, unique } from "@/lib/db";
import { newId, slugify } from "@/lib/ids";

export const ROLES = ["auditeur", "artiste", "admin"];

export async function findUserByEmail(email) {
  return unique("SELECT * FROM users WHERE email = $1", [
    String(email || "").toLowerCase().trim(),
  ]);
}

export async function findUserById(id) {
  return unique("SELECT * FROM users WHERE id = $1", [id]);
}

export async function uniqueArtistSlug(name) {
  const base = slugify(name);
  let slug = base;
  let n = 2;
  while (await unique("SELECT 1 FROM artists WHERE slug = $1", [slug])) {
    slug = `${base}-${n++}`;
  }
  return slug;
}

/**
 * Cree un compte. Si role = "artiste", la fiche artiste est creee dans la
 * meme transaction : un artiste sans fiche ne pourrait rien publier.
 */
export async function createUser({ name, email, password, role = "auditeur", city, bio }) {
  const normalizedEmail = String(email).toLowerCase().trim();
  if (await findUserByEmail(normalizedEmail)) {
    throw new Error("Un compte existe deja avec cette adresse e-mail.");
  }

  const userId = newId("usr");
  const passwordHash = bcrypt.hashSync(password, 10);
  const wantsArtist = role === "artiste";
  const slug = wantsArtist ? await uniqueArtistSlug(name) : null;

  await transaction(async (q) => {
    await q(
      `INSERT INTO users (id, name, email, password_hash, role)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, name, normalizedEmail, passwordHash, wantsArtist ? "artiste" : "auditeur"],
    );

    if (wantsArtist) {
      await q(
        `INSERT INTO artists (id, user_id, name, slug, bio, city)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [newId("art"), userId, name, slug, bio || null, city || null],
      );
    }
  });

  return findUserById(userId);
}

export function verifyPassword(user, password) {
  if (!user?.password_hash) return false;
  return bcrypt.compareSync(password, user.password_hash);
}

/** Promeut un auditeur en artiste (creation de la fiche associee). */
export async function promoteToArtist(userId, { stageName, city, bio } = {}) {
  const user = await findUserById(userId);
  if (!user) throw new Error("Compte introuvable.");

  const existing = await unique("SELECT * FROM artists WHERE user_id = $1", [userId]);
  if (existing) return existing;

  const name = stageName?.trim() || user.name;
  const artistId = newId("art");
  const slug = await uniqueArtistSlug(name);

  await transaction(async (q) => {
    await q(
      `INSERT INTO artists (id, user_id, name, slug, bio, city)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [artistId, userId, name, slug, bio || null, city || null],
    );
    await q("UPDATE users SET role = 'artiste' WHERE id = $1", [userId]);
  });

  return unique("SELECT * FROM artists WHERE id = $1", [artistId]);
}

export async function changerNom(userId, nom) {
  await execute("UPDATE users SET name = $1 WHERE id = $2", [nom, userId]);
  return findUserById(userId);
}

export async function supprimerCompte(userId) {
  await execute("DELETE FROM users WHERE id = $1", [userId]);
}

export function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    avatarUrl: user.avatar_url,
  };
}
