-- Prescreening questions (organization-level question bank + system predefined)
CREATE TABLE IF NOT EXISTS prescreening_questions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employer_id UUID REFERENCES employers(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  question_type TEXT NOT NULL DEFAULT 'text',
  options JSONB DEFAULT '[]'::jsonb,
  is_predefined BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by_name TEXT,
  created_by_email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prescreening_questions_employer
  ON prescreening_questions(employer_id);

CREATE INDEX IF NOT EXISTS idx_prescreening_questions_predefined
  ON prescreening_questions(is_predefined) WHERE is_predefined = true;

-- Per-job question settings (enabled + required/optional)
CREATE TABLE IF NOT EXISTS job_prescreening_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES prescreening_questions(id) ON DELETE CASCADE,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  is_required BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(job_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_job_prescreening_job
  ON job_prescreening_settings(job_id);

-- Candidate answers per application
CREATE TABLE IF NOT EXISTS application_prescreening_answers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES prescreening_questions(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  answer TEXT,
  is_required BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(application_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_app_prescreening_application
  ON application_prescreening_answers(application_id);

-- Seed 15 predefined system questions (employer_id NULL = global)
INSERT INTO prescreening_questions (question_text, question_type, is_predefined, sort_order)
SELECT q.text, q.qtype, true, q.ord
FROM (VALUES
  (1,  'Are you legally authorized to work in the country where this job is located?', 'yes_no'),
  (2,  'Will you now or in the future require sponsorship for an employment visa?', 'yes_no'),
  (3,  'What is your expected salary range for this position?', 'text'),
  (4,  'When are you available to start?', 'text'),
  (5,  'How many years of relevant experience do you have for this role?', 'text'),
  (6,  'Are you willing to relocate if required for this position?', 'yes_no'),
  (7,  'What is your highest level of education completed?', 'text'),
  (8,  'Are you currently employed?', 'yes_no'),
  (9,  'Why are you interested in this position and our company?', 'textarea'),
  (10, 'What are your key strengths relevant to this role?', 'textarea'),
  (11, 'Do you have experience working in a remote or distributed team?', 'yes_no'),
  (12, 'What is your preferred work arrangement (remote, hybrid, or on-site)?', 'text'),
  (13, 'Are you open to travel as part of this role, if required?', 'yes_no'),
  (14, 'How did you hear about this position?', 'text'),
  (15, 'Do you have any conflicts of interest or non-compete agreements we should know about?', 'textarea')
) AS q(ord, text, qtype)
WHERE NOT EXISTS (
  SELECT 1 FROM prescreening_questions WHERE is_predefined = true LIMIT 1
);
