-- HireFlow Database Schema for PostgreSQL
-- Simplified version without Supabase auth

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Employers table (with built-in auth)
CREATE TABLE IF NOT EXISTS employers (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_name text NOT NULL,
  company_description text,
  company_logo_url text,
  contact_email text NOT NULL UNIQUE,
  contact_phone text,
  industry text,
  company_size text,
  website text,
  password_hash text NOT NULL,
  settings jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Jobs table
CREATE TABLE IF NOT EXISTS jobs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  employer_id uuid REFERENCES employers(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  requirements text,
  responsibilities text,
  skills_required text[] DEFAULT ARRAY[]::text[],
  location text,
  work_type text DEFAULT 'full-time',
  remote_policy text DEFAULT 'on-site',
  salary_min numeric,
  salary_max numeric,
  salary_currency text DEFAULT 'USD',
  experience_level text,
  education_required text,
  status text DEFAULT 'draft',
  application_deadline timestamptz,
  positions_available integer DEFAULT 1,
  positions_filled integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Candidates table
CREATE TABLE IF NOT EXISTS candidates (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  email text NOT NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  phone text,
  location text,
  linkedin_url text,
  portfolio_url text,
  resume_url text,
  picture_url text,
  resume_parsed_data jsonb DEFAULT '{}'::jsonb,
  cover_letter text,
  skills text[] DEFAULT ARRAY[]::text[],
  experience_years numeric,
  education jsonb DEFAULT '[]'::jsonb,
  work_history jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_candidates_email ON candidates(email);

-- Applications table
CREATE TABLE IF NOT EXISTS applications (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id uuid REFERENCES jobs(id) ON DELETE CASCADE NOT NULL,
  candidate_id uuid REFERENCES candidates(id) ON DELETE CASCADE NOT NULL,
  status text DEFAULT 'applied',
  current_stage text DEFAULT 'application_received',
  application_date timestamptz DEFAULT now(),
  screening_completed_at timestamptz,
  shortlist_approved_at timestamptz,
  test_completed_at timestamptz,
  test_approved_at timestamptz,
  ai_interview_completed_at timestamptz,
  ai_interview_approved_at timestamptz,
  final_interview_scheduled_at timestamptz,
  final_interview_completed_at timestamptz,
  offer_date timestamptz,
  hire_date timestamptz,
  rejection_date timestamptz,
  rejection_reason text,
  employer_notes text,
  overall_score numeric DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(job_id, candidate_id)
);

-- Resume scores table
CREATE TABLE IF NOT EXISTS resume_scores (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  application_id uuid REFERENCES applications(id) ON DELETE CASCADE NOT NULL UNIQUE,
  overall_score numeric NOT NULL DEFAULT 0,
  skills_match_score numeric DEFAULT 0,
  experience_score numeric DEFAULT 0,
  education_score numeric DEFAULT 0,
  keywords_matched text[] DEFAULT ARRAY[]::text[],
  keywords_missing text[] DEFAULT ARRAY[]::text[],
  ai_summary text,
  strengths text[] DEFAULT ARRAY[]::text[],
  weaknesses text[] DEFAULT ARRAY[]::text[],
  recommendation text,
  scored_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Tests table
CREATE TABLE IF NOT EXISTS tests (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id uuid REFERENCES jobs(id) ON DELETE CASCADE NOT NULL,
  employer_id uuid REFERENCES employers(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  description text,
  test_type text DEFAULT 'mcq',
  duration_minutes integer,
  passing_score numeric DEFAULT 70,
  questions jsonb DEFAULT '[]'::jsonb,
  answer_key jsonb DEFAULT '{}'::jsonb,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Test attempts table
CREATE TABLE IF NOT EXISTS test_attempts (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  application_id uuid REFERENCES applications(id) ON DELETE CASCADE NOT NULL,
  test_id uuid REFERENCES tests(id) ON DELETE CASCADE NOT NULL,
  started_at timestamptz DEFAULT now(),
  submitted_at timestamptz,
  answers jsonb DEFAULT '{}'::jsonb,
  score numeric DEFAULT 0,
  max_score numeric DEFAULT 100,
  percentage numeric DEFAULT 0,
  passed boolean DEFAULT false,
  feedback text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(application_id, test_id)
);

-- AI Interviews table
CREATE TABLE IF NOT EXISTS ai_interviews (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  application_id uuid REFERENCES applications(id) ON DELETE CASCADE NOT NULL,
  interview_token text UNIQUE,
  started_at timestamptz,
  completed_at timestamptz,
  questions_asked jsonb DEFAULT '[]'::jsonb,
  candidate_responses jsonb DEFAULT '[]'::jsonb,
  communication_score numeric,
  technical_score numeric,
  behavioral_score numeric,
  overall_score numeric,
  ai_summary text,
  recommendation text,
  transcript text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Final Interviews table
CREATE TABLE IF NOT EXISTS final_interviews (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  application_id uuid REFERENCES applications(id) ON DELETE CASCADE NOT NULL,
  scheduled_at timestamptz,
  completed_at timestamptz,
  interviewer_name text,
  interview_notes text,
  rating numeric,
  recommendation text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Approval gates table
CREATE TABLE IF NOT EXISTS approval_gates (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  application_id uuid REFERENCES applications(id) ON DELETE CASCADE NOT NULL,
  gate_name text NOT NULL,
  approved boolean,
  approved_by uuid REFERENCES employers(id) ON DELETE SET NULL,
  decision_date timestamptz DEFAULT now(),
  notes text,
  previous_status text,
  new_status text,
  created_at timestamptz DEFAULT now()
);

-- Email logs table
CREATE TABLE IF NOT EXISTS email_logs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  application_id uuid REFERENCES applications(id) ON DELETE CASCADE,
  candidate_id uuid REFERENCES candidates(id) ON DELETE CASCADE NOT NULL,
  email_type text NOT NULL,
  recipient_email text NOT NULL,
  subject text NOT NULL,
  body text NOT NULL,
  sent_at timestamptz DEFAULT now(),
  delivery_status text DEFAULT 'sent',
  error_message text,
  created_at timestamptz DEFAULT now()
);

-- Email templates table
CREATE TABLE IF NOT EXISTS email_templates (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  employer_id uuid REFERENCES employers(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  subject text NOT NULL,
  body text NOT NULL,
  template_type text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Bulk upload sessions table
CREATE TABLE IF NOT EXISTS bulk_upload_sessions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  employer_id uuid REFERENCES employers(id) ON DELETE CASCADE NOT NULL,
  job_id uuid REFERENCES jobs(id) ON DELETE CASCADE NOT NULL,
  total_candidates integer NOT NULL DEFAULT 0,
  processed_candidates integer NOT NULL DEFAULT 0,
  status text DEFAULT 'processing',
  error_log jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_jobs_employer ON jobs(employer_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_applications_job ON applications(job_id);
CREATE INDEX IF NOT EXISTS idx_applications_candidate ON applications(candidate_id);
CREATE INDEX IF NOT EXISTS idx_applications_status ON applications(status);
CREATE INDEX IF NOT EXISTS idx_tests_job ON tests(job_id);
CREATE INDEX IF NOT EXISTS idx_ai_interviews_application ON ai_interviews(application_id);
CREATE INDEX IF NOT EXISTS idx_approval_gates_application ON approval_gates(application_id);
