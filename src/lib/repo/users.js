import bcrypt from "bcryptjs";
import { getDb } from "@/lib/db";
import { newId, slugify } from "@/lib/ids";

export const ROLES = ["auditeur", "artiste", "admin"];

export function findUserByEmail(email) {
  return getDb()
    .prepare("SELECT * FROM users WHERE email = ?")
    .get(String(email || "").toLowerCase().trim());
}

export function findUserById(id) {
  return getDb().prepare("SELECT * FROM users WHERE id = ?").get(id);
}

/**
 * Cree un compte. Si role = "artiste", la fiche artiste est creee dans la
 * meme transaction : un artiste sans fiche ne pourrait rien publier.
 */
export function createUser({ name, email, password, role = "auditeur", city, bio }) {
  const db = getDb();
  const normalizedEmail = String(email).toLowerCase().trim();
  if (findUserByEmail(normalizedEmail)) {
    throw new Error("Un compte existe deja avec cette adresse e-mail.");
  }

  const userId = newId("usr");
  const passwordHash = bcrypt.hashSync(password, 10);
  const wantsArtist = role === "artiste";

  const run = db.transaction(() => {
    db.prepare(
      `INSERT INTO users (id, name, email, password_hash, role)
       VALUES (?, ?, ?, ?, ?)`,
    ).run(userId, name, normalizedEmail, passwordHash, wantsArtist ? "artiste" : "auditeur");

    if (wantsArtist) {
      db.prepare(
        `INSERT INTO artists (id, user_id, name, slug, bio, city)
         VALUES (?, ?, ?, ?, ?, ?)`,
      ).run(newId("art"), userId, name, uniqueArtistSlug(name), bio || null, city || null);
    }
  });
  run();

  return findUserById(userId);
}

export function uniqueArtistSlug(name) {
  const db = getDb();
  const base = slugify(name);
  let slug = base;
  let n = 2;
  while (db.prepare("SELECT 1 FROM artists WHERE slug = ?").get(slug)) {
    slug = `${base}-${n++}`;
  }
  return slug;
}

export function verifyPassword(user, password) {
  if (!user?.password_hash) return false;
  return bcrypt.compareSync(password, user.password_hash);
}

/** Promeut un auditeur en artiste (creation de la fiche associee). */
export function promoteToArtist(userId, { stageName, city, bio } = {}) {
  const db = getDb();
  const user = findUserById(userId);
  if (!user) throw new Error("Compte introuvable.");

  const existing = db.prepare("SELECT * FROM artists WHERE user_id = ?").get(userId);
  if (existing) return existing;

  const name = stageName?.trim() || user.name;
  const artistId = newId("art");
  db.transaction(() => {
    db.prepare(
      `INSERT INTO artists (id, user_id, name, slug, bio, city)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(artistId, userId, name, uniqueArtistSlug(name), bio || null, city || null);
    db.prepare("UPDATE users SET role = 'artiste' WHERE id = ?").run(userId);
  })();

  return db.prepare("SELECT * FROM artists WHERE id = ?").get(artistId);
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
