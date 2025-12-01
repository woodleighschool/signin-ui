-- Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- updated_at trigger
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-----------------------------------------------------------------------
-- Core entities
-----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  upn          TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  object_id    TEXT,
  department   TEXT,
  is_admin     BOOLEAN NOT NULL DEFAULT FALSE,
  location_ids UUID[] NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS groups (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name TEXT NOT NULL,
  description  TEXT,
  object_id    TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS group_members (
  group_id   UUID NOT NULL REFERENCES groups (id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (group_id, user_id)
);

-----------------------------------------------------------------------
-- Locations and portal keys
-----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS locations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  identifier    TEXT NOT NULL UNIQUE,
  group_ids     UUID[] NOT NULL DEFAULT '{}',
  notes_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_locations_identifier_lower
  ON locations (LOWER(identifier));

CREATE TABLE IF NOT EXISTS keys (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  description  TEXT,
  key_value    TEXT NOT NULL UNIQUE,
  location_ids UUID[] NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ
);

-----------------------------------------------------------------------
-- Check-ins
-----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS checkins (
  id          BIGSERIAL PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES locations (id) ON DELETE CASCADE,
  key_id      UUID REFERENCES keys (id) ON DELETE SET NULL,
  direction   TEXT NOT NULL CHECK (direction IN ('in', 'out')),
  notes       TEXT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_checkins_location_time
  ON checkins (location_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_checkins_user_time
  ON checkins (user_id, occurred_at DESC);

-----------------------------------------------------------------------
-- Assets (generic binary blobs e.g. portal backgrounds)
-----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS assets (
  key          TEXT PRIMARY KEY,
  content_type TEXT NOT NULL,
  data         BYTEA NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-----------------------------------------------------------------------
-- Triggers (updated_at)
-----------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_users_updated_at') THEN
    CREATE TRIGGER trg_users_updated_at
      BEFORE UPDATE ON users
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_groups_updated_at') THEN
    CREATE TRIGGER trg_groups_updated_at
      BEFORE UPDATE ON groups
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_locations_updated_at') THEN
    CREATE TRIGGER trg_locations_updated_at
      BEFORE UPDATE ON locations
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_keys_updated_at') THEN
    CREATE TRIGGER trg_keys_updated_at
      BEFORE UPDATE ON keys
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_assets_updated_at') THEN
    CREATE TRIGGER trg_assets_updated_at
      BEFORE UPDATE ON assets
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END
$$;

-----------------------------------------------------------------------
-- Indexes
-----------------------------------------------------------------------
-- Users
CREATE INDEX IF NOT EXISTS idx_users_upn_lower
  ON users (LOWER(upn));

CREATE INDEX IF NOT EXISTS idx_users_search_vector
  ON users USING GIN (
    to_tsvector(
      'simple',
      COALESCE(display_name, '') || ' ' || COALESCE(upn, '')
    )
  );

-- Groups
CREATE INDEX IF NOT EXISTS idx_groups_display_name_lower
  ON groups (LOWER(display_name));

CREATE INDEX IF NOT EXISTS idx_groups_search_vector
  ON groups USING GIN (
    to_tsvector(
      'simple',
      COALESCE(display_name, '') || ' ' || COALESCE(description, '')
    )
  );

-- Group members
CREATE INDEX IF NOT EXISTS idx_group_members_user
  ON group_members (user_id);
