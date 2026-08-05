-- Per-organization external jobs API credentials (replaces single env employer scope)

ALTER TABLE employers
  ADD COLUMN IF NOT EXISTS external_api_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS external_api_slug TEXT,
  ADD COLUMN IF NOT EXISTS external_api_username TEXT,
  ADD COLUMN IF NOT EXISTS external_api_password_hash TEXT,
  ADD COLUMN IF NOT EXISTS external_api_key_prefix TEXT,
  ADD COLUMN IF NOT EXISTS external_api_updated_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS idx_employers_external_api_slug
  ON employers (lower(external_api_slug))
  WHERE external_api_slug IS NOT NULL AND btrim(external_api_slug) <> '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_employers_external_api_username
  ON employers (lower(external_api_username))
  WHERE external_api_username IS NOT NULL AND btrim(external_api_username) <> '';
