-- Job requisitions (RBAC submit → HR/Admin review) + audit events

CREATE TABLE IF NOT EXISTS job_requisitions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  employer_id uuid NOT NULL REFERENCES employers(id) ON DELETE CASCADE,
  submitted_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  submitted_by_name text,
  submitted_by_email text,
  job_title text NOT NULL,
  department text,
  positions_count integer NOT NULL DEFAULT 1,
  location text,
  work_type text,
  justification text,
  skills_required text,
  budget_min numeric,
  budget_max numeric,
  urgency text DEFAULT 'medium',
  additional_notes text,
  status text NOT NULL DEFAULT 'pending',
  hr_message text,
  decided_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  decided_by_name text,
  decided_by_email text,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_job_requisitions_employer_status
  ON job_requisitions (employer_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_job_requisitions_submitter
  ON job_requisitions (employer_id, submitted_by_user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS requisition_events (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  requisition_id uuid NOT NULL REFERENCES job_requisitions(id) ON DELETE CASCADE,
  employer_id uuid NOT NULL REFERENCES employers(id) ON DELETE CASCADE,
  action text NOT NULL,
  message text,
  from_status text,
  to_status text,
  actor_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  actor_name text,
  actor_email text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_requisition_events_requisition
  ON requisition_events (requisition_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_requisition_events_employer
  ON requisition_events (employer_id, created_at DESC);

-- Backfill requisitions permissions for existing default roles
INSERT INTO permissions (role_id, resource, can_read, can_write, can_edit, can_delete)
SELECT r.id, 'requisitions', true, true, true, true
FROM roles r
WHERE lower(r.name) = 'admin'
  AND NOT EXISTS (
    SELECT 1 FROM permissions p WHERE p.role_id = r.id AND p.resource = 'requisitions'
  );

INSERT INTO permissions (role_id, resource, can_read, can_write, can_edit, can_delete)
SELECT r.id, 'requisitions', true, false, true, false
FROM roles r
WHERE lower(r.name) = 'manager'
  AND NOT EXISTS (
    SELECT 1 FROM permissions p WHERE p.role_id = r.id AND p.resource = 'requisitions'
  );

INSERT INTO permissions (role_id, resource, can_read, can_write, can_edit, can_delete)
SELECT r.id, 'requisitions', true, true, false, false
FROM roles r
WHERE lower(r.name) = 'recruiter'
  AND NOT EXISTS (
    SELECT 1 FROM permissions p WHERE p.role_id = r.id AND p.resource = 'requisitions'
  );

INSERT INTO permissions (role_id, resource, can_read, can_write, can_edit, can_delete)
SELECT r.id, 'requisitions', true, false, false, false
FROM roles r
WHERE lower(r.name) = 'viewer'
  AND NOT EXISTS (
    SELECT 1 FROM permissions p WHERE p.role_id = r.id AND p.resource = 'requisitions'
  );
