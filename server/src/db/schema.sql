-- Matcha schema — requêtes manuelles, pas d'ORM
-- Extensions utiles pour la distance géo

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE gender_t AS ENUM ('male', 'female', 'other');
CREATE TYPE orientation_t AS ENUM ('heterosexual', 'homosexual', 'bisexual');

CREATE TABLE users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email           TEXT NOT NULL UNIQUE,
  username        TEXT NOT NULL UNIQUE,
  first_name      TEXT NOT NULL,
  last_name       TEXT NOT NULL,
  password_hash   TEXT NOT NULL,
  email_verified  BOOLEAN NOT NULL DEFAULT FALSE,
  verify_token    TEXT UNIQUE,
  reset_token     TEXT UNIQUE,
  reset_expires   TIMESTAMPTZ,
  gender          gender_t,
  orientation     orientation_t NOT NULL DEFAULT 'bisexual',
  bio             TEXT,
  birth_date      DATE,
  fame_rating     INTEGER NOT NULL DEFAULT 0,
  latitude        DOUBLE PRECISION,
  longitude       DOUBLE PRECISION,
  location_label  TEXT,
  gps_consent     BOOLEAN NOT NULL DEFAULT FALSE,
  is_online       BOOLEAN NOT NULL DEFAULT FALSE,
  last_seen_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT bio_len CHECK (bio IS NULL OR char_length(bio) <= 500)
);

CREATE TABLE tags (
  id    SERIAL PRIMARY KEY,
  label TEXT NOT NULL UNIQUE
);

CREATE TABLE user_tags (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tag_id  INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, tag_id)
);

CREATE TABLE photos (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  path         TEXT NOT NULL,
  is_profile   BOOLEAN NOT NULL DEFAULT FALSE,
  position     SMALLINT NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT photos_per_user CHECK (position BETWEEN 0 AND 4)
);

CREATE UNIQUE INDEX photos_one_profile_per_user
  ON photos (user_id)
  WHERE is_profile = TRUE;

CREATE TABLE likes (
  from_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_user_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (from_user_id, to_user_id),
  CONSTRAINT no_self_like CHECK (from_user_id <> to_user_id)
);

-- Match = like réciproque (vue pratique)
CREATE VIEW matches AS
SELECT
  l1.from_user_id AS user_a,
  l1.to_user_id   AS user_b,
  GREATEST(l1.created_at, l2.created_at) AS matched_at
FROM likes l1
JOIN likes l2
  ON l1.from_user_id = l2.to_user_id
 AND l1.to_user_id   = l2.from_user_id
WHERE l1.from_user_id < l1.to_user_id;

CREATE TABLE profile_views (
  viewer_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  viewed_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  viewed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (viewer_id, viewed_id),
  CONSTRAINT no_self_view CHECK (viewer_id <> viewed_id)
);

CREATE TABLE blocks (
  blocker_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (blocker_id, blocked_id),
  CONSTRAINT no_self_block CHECK (blocker_id <> blocked_id)
);

CREATE TABLE reports (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reported_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason      TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT no_self_report CHECK (reporter_id <> reported_id)
);

CREATE TABLE conversations (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_b     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_a, user_b),
  CONSTRAINT conv_ordered CHECK (user_a < user_b)
);

CREATE TABLE messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body            TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read_at         TIMESTAMPTZ,
  CONSTRAINT msg_body_len CHECK (char_length(body) BETWEEN 1 AND 2000)
);

CREATE TYPE notif_kind_t AS ENUM (
  'like',
  'unlike',
  'view',
  'message',
  'match'
);

CREATE TABLE notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  actor_id    UUID REFERENCES users(id) ON DELETE SET NULL,
  kind        notif_kind_t NOT NULL,
  payload     JSONB NOT NULL DEFAULT '{}',
  is_read     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE sessions (
  sid    TEXT PRIMARY KEY,
  sess   JSONB NOT NULL,
  expire TIMESTAMPTZ NOT NULL
);

-- Index matching / recherche
CREATE INDEX users_geo_idx ON users (latitude, longitude)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
CREATE INDEX users_fame_idx ON users (fame_rating DESC);
CREATE INDEX users_birth_idx ON users (birth_date);
CREATE INDEX likes_to_idx ON likes (to_user_id);
CREATE INDEX likes_from_idx ON likes (from_user_id);
CREATE INDEX notif_user_unread_idx ON notifications (user_id) WHERE is_read = FALSE;
CREATE INDEX messages_conv_idx ON messages (conversation_id, created_at);
CREATE INDEX sessions_expire_idx ON sessions (expire);
