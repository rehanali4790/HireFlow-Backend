-- Candidate blacklist (employer-scoped) + audit events + restore helper column

CREATE TABLE IF NOT EXISTS candidate_blacklist (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  employer_id uuid NOT NULL REFERENCES employers(id) ON DELETE CASCADE,
  candidate_id uuid NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  email text NOT NULL,
  phone text,
  reason text NOT NULL,
  blacklisted_by_name text,
  blacklisted_by_email text,
  blacklisted_at timestamptz NOT NULL DEFAULT NOW(),
  removed_at timestamptz,
  removed_by_name text,
  removed_by_email text,
  remove_reason text,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_candidate_blacklist_active_unique
  ON candidate_blacklist (employer_id, candidate_id)
  WHERE removed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_candidate_blacklist_employer_active
  ON candidate_blacklist (employer_id)
  WHERE removed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_candidate_blacklist_email_active
  ON candidate_blacklist (employer_id, lower(email))
  WHERE removed_at IS NULL;

CREATE TABLE IF NOT EXISTS blacklist_events (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  employer_id uuid NOT NULL REFERENCES employers(id) ON DELETE CASCADE,
  candidate_id uuid REFERENCES candidates(id) ON DELETE SET NULL,
  application_id uuid REFERENCES applications(id) ON DELETE SET NULL,
  action text NOT NULL,
  reason text,
  actor_name text,
  actor_email text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_blacklist_events_employer
  ON blacklist_events (employer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_blacklist_events_candidate
  ON blacklist_events (candidate_id, created_at DESC);

ALTER TABLE applications
  ADD COLUMN IF NOT EXISTS status_before_blacklist text;
