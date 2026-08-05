-- Employer-scoped job departments for job form dropdown

CREATE TABLE IF NOT EXISTS job_departments (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  employer_id uuid NOT NULL REFERENCES employers(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_job_departments_employer_name
  ON job_departments (employer_id, lower(btrim(name)));

CREATE INDEX IF NOT EXISTS idx_job_departments_employer
  ON job_departments (employer_id, name);

ALTER TABLE jobs ADD COLUMN IF NOT EXISTS department text;

-- Backfill from existing job department strings (if any)
INSERT INTO job_departments (employer_id, name)
SELECT DISTINCT j.employer_id, btrim(j.department)
FROM jobs j
WHERE j.department IS NOT NULL AND btrim(j.department) <> ''
  AND NOT EXISTS (
    SELECT 1 FROM job_departments jd
    WHERE jd.employer_id = j.employer_id
      AND lower(btrim(jd.name)) = lower(btrim(j.department))
  );
