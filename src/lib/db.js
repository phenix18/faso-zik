import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

/**
 * Couche de donnees FASO-ZIK.
 *
 * SQLite est volontairement choisi : la plateforme heberge elle-meme les
 * fichiers audio/video sur disque, elle se deploie donc sur un VPS ou un
 * conteneur avec un volume persistant. Un moteur embarque evite un service
 * externe de plus. Toutes les requetes passent par src/lib/repo/* : migrer
 * vers Postgres revient a reecrire ces modules, pas l'application.
 */

const DB_FILE =
  process.env.DATABASE_FILE || path.join(process.cwd(), "data", "faso-zik.db");

let db;

function migrate(database) {
  database.pragma("journal_mode = WAL");
  database.pragma("foreign_keys = ON");

  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id            TEXT PRIMARY KEY,
      name          TEXT NOT NULL,
      email         TEXT NOT NULL UNIQUE,
      password_hash TEXT,
      role          TEXT NOT NULL DEFAULT 'auditeur',
      avatar_url    TEXT,
      created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS artists (
      id         TEXT PRIMARY KEY,
      user_id    TEXT UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      name       TEXT NOT NULL,
      slug       TEXT NOT NULL UNIQUE,
      bio        TEXT,
      city       TEXT,
      country    TEXT DEFAULT 'Burkina Faso',
      genres     TEXT,
      photo_url  TEXT,
      verified   INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS tracks (
      id             TEXT PRIMARY KEY,
      artist_id      TEXT NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
      title          TEXT NOT NULL,
      slug           TEXT NOT NULL,
      kind           TEXT NOT NULL DEFAULT 'audio',
      genre          TEXT,
      language       TEXT,
      description    TEXT,
      duration       REAL DEFAULT 0,
      bpm            REAL,
      music_key      TEXT,
      cover_url      TEXT,
      media_path     TEXT NOT NULL,
      media_mime     TEXT NOT NULL,
      media_size     INTEGER NOT NULL DEFAULT 0,
      -- Autorisations accordees par l'artiste, morceau par morceau.
      allow_stream   INTEGER NOT NULL DEFAULT 1,
      allow_download INTEGER NOT NULL DEFAULT 0,
      allow_dj       INTEGER NOT NULL DEFAULT 0,
      license        TEXT DEFAULT 'Tous droits reserves',
      -- Attestation du deposant : il declare detenir les droits sur ce depot.
      rights_confirmed INTEGER NOT NULL DEFAULT 0,
      published      INTEGER NOT NULL DEFAULT 1,
      plays          INTEGER NOT NULL DEFAULT 0,
      downloads      INTEGER NOT NULL DEFAULT 0,
      created_at     TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS playlists (
      id         TEXT PRIMARY KEY,
      user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name       TEXT NOT NULL,
      is_public  INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS playlist_tracks (
      playlist_id TEXT NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
      track_id    TEXT NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
      position    INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (playlist_id, track_id)
    );

    CREATE TABLE IF NOT EXISTS favourites (
      user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      track_id   TEXT NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (user_id, track_id)
    );

    CREATE TABLE IF NOT EXISTS follows (
      user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      artist_id  TEXT NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (user_id, artist_id)
    );

    CREATE TABLE IF NOT EXISTS payments (
      id           TEXT PRIMARY KEY,
      -- Reference publique, celle qui apparait dans les URL et les recus.
      reference    TEXT NOT NULL UNIQUE,
      user_id      TEXT REFERENCES users(id) ON DELETE SET NULL,
      artist_id    TEXT NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
      track_id     TEXT REFERENCES tracks(id) ON DELETE SET NULL,
      type         TEXT NOT NULL,
      amount_cfa   INTEGER NOT NULL,
      operator     TEXT NOT NULL,
      phone        TEXT NOT NULL,
      status       TEXT NOT NULL DEFAULT 'attente',
      provider     TEXT NOT NULL,
      provider_ref TEXT,
      message      TEXT,
      created_at   TEXT NOT NULL DEFAULT (datetime('now')),
      paid_at      TEXT
    );

    CREATE TABLE IF NOT EXISTS events (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      track_id   TEXT NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
      user_id    TEXT REFERENCES users(id) ON DELETE SET NULL,
      type       TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_tracks_artist  ON tracks(artist_id);
    CREATE INDEX IF NOT EXISTS idx_tracks_kind    ON tracks(kind, published);
    CREATE INDEX IF NOT EXISTS idx_tracks_created ON tracks(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_events_track   ON events(track_id, type);
    CREATE INDEX IF NOT EXISTS idx_follows_artist ON follows(artist_id);
    CREATE INDEX IF NOT EXISTS idx_payments_artist ON payments(artist_id, status);
    CREATE INDEX IF NOT EXISTS idx_payments_achat  ON payments(user_id, track_id, status);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_tracks_slug ON tracks(artist_id, slug);
  `);

  // Colonnes ajoutees apres coup : CREATE TABLE IF NOT EXISTS ne les pose pas
  // sur une base deja creee, il faut donc les rattraper une par une.
  ensureColumn(database, "tracks", "rights_confirmed", "INTEGER NOT NULL DEFAULT 0");

  // Versions allegees fabriquees apres le depot (voir src/lib/transcode.js).
  ensureColumn(database, "tracks", "preview_path", "TEXT");
  ensureColumn(database, "tracks", "preview_mime", "TEXT");
  ensureColumn(database, "tracks", "preview_size", "INTEGER");
  ensureColumn(database, "tracks", "hls_path", "TEXT");
  ensureColumn(database, "tracks", "transcode_status", "TEXT NOT NULL DEFAULT 'absent'");

  // Prix du telechargement, en francs CFA. Zero signifie gratuit.
  ensureColumn(database, "tracks", "price_cfa", "INTEGER NOT NULL DEFAULT 0");
}

function ensureColumn(database, table, column, definition) {
  const columns = database.prepare(`PRAGMA table_info(${table})`).all();
  if (columns.some((entry) => entry.name === column)) return;
  database.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

export function getDb() {
  if (!db) {
    fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
    db = new Database(DB_FILE);
    migrate(db);
  }
  return db;
}

export { DB_FILE };
