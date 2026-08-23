/**
 * Schema de la base.
 *
 * Applique a chaque demarrage, en entier : tout y est conditionnel
 * (`IF NOT EXISTS`), ce qui rend l'operation sans effet sur une base deja a
 * jour et evite d'avoir a suivre un numero de version.
 *
 * Les drapeaux d'autorisation sont de vrais booleens : sous SQLite ils
 * valaient 0 ou 1, et chaque lecture devait les reconvertir.
 */
export const schema = `
CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT,
  role          TEXT NOT NULL DEFAULT 'auditeur',
  avatar_url    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
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
  verified   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS albums (
  id          TEXT PRIMARY KEY,
  artist_id   TEXT NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  slug        TEXT NOT NULL,
  kind        TEXT NOT NULL DEFAULT 'album',
  description TEXT,
  cover_url   TEXT,
  released_on TEXT,
  published   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tracks (
  id               TEXT PRIMARY KEY,
  artist_id        TEXT NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
  album_id         TEXT REFERENCES albums(id) ON DELETE SET NULL,
  track_no         INTEGER,
  title            TEXT NOT NULL,
  slug             TEXT NOT NULL,
  kind             TEXT NOT NULL DEFAULT 'audio',
  genre            TEXT,
  language         TEXT,
  description      TEXT,
  duration         REAL DEFAULT 0,
  bpm              REAL,
  music_key        TEXT,
  cover_url        TEXT,
  media_path       TEXT NOT NULL,
  media_mime       TEXT NOT NULL,
  media_size       BIGINT NOT NULL DEFAULT 0,
  preview_path     TEXT,
  preview_mime     TEXT,
  preview_size     BIGINT,
  -- Autorisations accordees par l'artiste, morceau par morceau.
  allow_stream     BOOLEAN NOT NULL DEFAULT TRUE,
  allow_download   BOOLEAN NOT NULL DEFAULT FALSE,
  allow_dj         BOOLEAN NOT NULL DEFAULT FALSE,
  price_cfa        INTEGER NOT NULL DEFAULT 0,
  license          TEXT DEFAULT 'Tous droits reserves',
  rights_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
  published        BOOLEAN NOT NULL DEFAULT TRUE,
  plays            INTEGER NOT NULL DEFAULT 0,
  downloads        INTEGER NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS playlists (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  is_public  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
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
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, track_id)
);

CREATE TABLE IF NOT EXISTS follows (
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  artist_id  TEXT NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, artist_id)
);

CREATE TABLE IF NOT EXISTS password_resets (
  -- Empreinte du jeton, jamais le jeton lui-meme.
  token_hash TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS payments (
  id           TEXT PRIMARY KEY,
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
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_at      TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS events (
  id         BIGSERIAL PRIMARY KEY,
  track_id   TEXT NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  user_id    TEXT REFERENCES users(id) ON DELETE SET NULL,
  type       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Compteur de debit partage. En memoire, il ne servait a rien des lors que
-- Commentaires du public sous un morceau. Ecrire demande un compte : c'est ce
-- qui rend la moderation possible, et ce qui decourage le deversement. Un
-- commentaire retire n'est pas efface mais masque, pour qu'un retrait conteste
-- puisse etre revu, et qu'on sache qui l'a decide.
CREATE TABLE IF NOT EXISTS comments (
  id         TEXT PRIMARY KEY,
  track_id   TEXT NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  corps      TEXT NOT NULL,
  masque     BOOLEAN NOT NULL DEFAULT FALSE,
  masque_par TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- plusieurs instances repondent : chacune aurait eu le sien.
CREATE TABLE IF NOT EXISTS rate_limits (
  cle        TEXT PRIMARY KEY,
  compte     INTEGER NOT NULL DEFAULT 0,
  expire_a   TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tracks_artist   ON tracks(artist_id);
CREATE INDEX IF NOT EXISTS idx_tracks_album    ON tracks(album_id);
CREATE INDEX IF NOT EXISTS idx_tracks_kind     ON tracks(kind, published);
CREATE INDEX IF NOT EXISTS idx_tracks_created  ON tracks(created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_tracks_slug  ON tracks(artist_id, slug);
CREATE UNIQUE INDEX IF NOT EXISTS idx_albums_slug  ON albums(artist_id, slug);
CREATE INDEX IF NOT EXISTS idx_events_track    ON events(track_id, type);
CREATE INDEX IF NOT EXISTS idx_events_recent   ON events(type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_follows_artist  ON follows(artist_id);
CREATE INDEX IF NOT EXISTS idx_payments_artist ON payments(artist_id, status);
CREATE INDEX IF NOT EXISTS idx_payments_achat  ON payments(user_id, track_id, status);
CREATE INDEX IF NOT EXISTS idx_rate_limits_exp ON rate_limits(expire_a);
CREATE INDEX IF NOT EXISTS idx_comments_track  ON comments(track_id, created_at DESC);
`;
