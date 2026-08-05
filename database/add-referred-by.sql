-- Optional referral name captured on apply form (per application)
ALTER TABLE applications
  ADD COLUMN IF NOT EXISTS referred_by text;

CREATE INDEX IF NOT EXISTS idx_applications_referred_by
  ON applications (lower(referred_by))
  WHERE referred_by IS NOT NULL AND length(trim(referred_by)) > 0;
