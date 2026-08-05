-- Employer-scoped job locations for job form dropdown

CREATE TABLE IF NOT EXISTS job_locations (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  employer_id uuid NOT NULL REFERENCES employers(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_job_locations_employer_name
  ON job_locations (employer_id, lower(btrim(name)));

CREATE INDEX IF NOT EXISTS idx_job_locations_employer
  ON job_locations (employer_id, name);

-- Backfill from existing job location strings
INSERT INTO job_locations (employer_id, name)
SELECT DISTINCT j.employer_id, btrim(j.location)
FROM jobs j
WHERE j.location IS NOT NULL AND btrim(j.location) <> ''
  AND NOT EXISTS (
    SELECT 1 FROM job_locations jl
    WHERE jl.employer_id = j.employer_id
      AND lower(btrim(jl.name)) = lower(btrim(j.location))
  );
