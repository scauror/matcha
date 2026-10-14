-- Bonus: OAuth identities + real-world dates

ALTER TYPE notif_kind_t ADD VALUE IF NOT EXISTS 'date';

CREATE TABLE IF NOT EXISTS oauth_identities (
  provider     TEXT NOT NULL,
  provider_id  TEXT NOT NULL,
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (provider, provider_id)
);

CREATE INDEX IF NOT EXISTS oauth_identities_user_idx ON oauth_identities (user_id);

CREATE TABLE IF NOT EXISTS dates (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id  UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  proposer_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title            TEXT NOT NULL,
  place            TEXT NOT NULL,
  starts_at        TIMESTAMPTZ NOT NULL,
  note             TEXT,
  status           TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'accepted', 'declined', 'cancelled')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT date_title_len CHECK (char_length(title) BETWEEN 1 AND 80),
  CONSTRAINT date_place_len CHECK (char_length(place) BETWEEN 1 AND 120)
);

CREATE INDEX IF NOT EXISTS dates_conv_idx ON dates (conversation_id, starts_at);
