-- HireFlow AI Database Schema Migration
-- Run this script in pgAdmin after connecting to hireflow_db database

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create employers table
CREATE TABLE IF NOT EXISTS employers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE,
  company_name VARCHAR(255) NOT NULL,
  company_description TEXT,
  company_logo_url TEXT,
  contact_email VARCHAR(255) NOT NULL,
  contact_phone VARCHAR(50),
  industry VARCHAR(100),
  company_size VARCHAR(50),
  website VARCHAR(255),
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create jobs table
CREATE TABLE IF NOT EXISTS jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employer_id UUID NOT NULL REFERENCES employers(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  requirements TEXT,
  responsibilities TEXT,
  skills_required TEXT[],
  location VARCHAR(255),
  work_type VARCHAR(50) DEFAULT 'full-time',
  remote_policy VARCHAR(50) DEFAULT 'on-site',
  salary_min DECIMAL(12,2),
  salary_max DECIMAL(12,2),
  salary_currency VARCHAR(10) DEFAULT 'USD',
  experience_level VARCHAR(50),
  education_required TEXT,
  status VARCHAR(50) DEFAULT 'draft',
  auto_publish_enabled BOOLEAN DEFAULT false,
  publish_to_boards TEXT[],
  application_deadline TIMESTAMP,
  positions_available INTEGER DEFAULT 1,
  positions_filled INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create candidates table
CREATE TABLE IF NOT EXISTS candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL UNIQUE,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  phone VARCHAR(50),
  location VARCHAR(255),
  linkedin_url TEXT,
  portfolio_url TEXT,
  resume_url TEXT,
  resume_parsed_data JSONB DEFAULT '{}',
  cover_letter TEXT,
  skills TEXT[],
  experience_years DECIMAL(4,1),
  education JSONB DEFAULT '[]',
  work_history JSONB DEFAULT '[]',
  is_duplicate BOOLEAN DEFAULT false,
  duplicate_of UUID REFERENCES candidates(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create applications table
CREATE TABLE IF NOT EXISTS applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  status VARCHAR(50) DEFAULT 'applied',
  current_stage VARCHAR(100) DEFAULT 'application_received',
  application_date TIMESTAMP DEFAULT NOW(),
  screening_completed_at TIMESTAMP,
  shortlist_approved_at TIMESTAMP,
  test_completed_at TIMESTAMP,
  test_approved_at TIMESTAMP,
  ai_interview_completed_at TIMESTAMP,
  ai_interview_approved_at TIMESTAMP,
  final_interview_scheduled_at TIMESTAMP,
  final_interview_completed_at TIMESTAMP,
  offer_date TIMESTAMP,
  hire_date TIMESTAMP,
  rejection_date TIMESTAMP,
  rejection_reason TEXT,
  employer_notes TEXT,
  overall_score DECIMAL(5,2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(job_id, candidate_id)
);

-- Create resume_scores table
CREATE TABLE IF NOT EXISTS resume_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  overall_score DECIMAL(5,2) DEFAULT 0,
  skills_match_score DECIMAL(5,2) DEFAULT 0,
  experience_score DECIMAL(5,2) DEFAULT 0,
  education_score DECIMAL(5,2) DEFAULT 0,
  keywords_matched TEXT[],
  keywords_missing TEXT[],
  ai_summary TEXT,
  strengths TEXT[],
  weaknesses TEXT[],
  recommendation VARCHAR(50),
  scored_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(application_id)
);

-- Create tests table
CREATE TABLE IF NOT EXISTS tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  employer_id UUID NOT NULL REFERENCES employers(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  test_type VARCHAR(50) DEFAULT 'mcq',
  duration_minutes INTEGER,
  passing_score DECIMAL(5,2) DEFAULT 70,
  questions JSONB DEFAULT '[]',
  answer_key JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  ai_evaluation_enabled BOOLEAN DEFAULT true,
  is_ai_generated BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create test_attempts table
CREATE TABLE IF NOT EXISTS test_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  test_id UUID NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
  started_at TIMESTAMP DEFAULT NOW(),
  submitted_at TIMESTAMP,
  answers JSONB DEFAULT '{}',
  score DECIMAL(5,2) DEFAULT 0,
  max_score DECIMAL(5,2) DEFAULT 100,
  percentage DECIMAL(5,2) DEFAULT 0,
  passed BOOLEAN DEFAULT false,
  ai_evaluation JSONB DEFAULT '{}',
  feedback TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(application_id, test_id)
);

-- Create ai_interviews table
CREATE TABLE IF NOT EXISTS ai_interviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  employer_id UUID NOT NULL,
  interview_token TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  expires_at TIMESTAMP NOT NULL DEFAULT (NOW() + INTERVAL '14 days'),
  transcript JSONB DEFAULT '[]',
  snapshots JSONB DEFAULT '[]',
  overall_score INTEGER,
  technical_score INTEGER,
  communication_score INTEGER,
  problem_solving_score INTEGER,
  feedback TEXT,
  recommendation TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create final_interviews table
CREATE TABLE IF NOT EXISTS final_interviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  ai_interview_id UUID REFERENCES ai_interviews(id) ON DELETE SET NULL,
  employer_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending_schedule',
  scheduled_at TIMESTAMP,
  duration_minutes INTEGER DEFAULT 60,
  meeting_link TEXT,
  meeting_notes TEXT,
  interview_type TEXT DEFAULT 'final',
  interviewer_name TEXT,
  interviewer_email TEXT,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  overall_score INTEGER,
  cultural_fit_score INTEGER,
  technical_fit_score INTEGER,
  communication_score INTEGER,
  final_recommendation TEXT,
  interviewer_feedback TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create interviews table (legacy)
CREATE TABLE IF NOT EXISTS interviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  interview_type TEXT DEFAULT 'ai_first',
  interview_mode TEXT DEFAULT 'text',
  scheduled_at TIMESTAMP,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  questions_asked JSONB DEFAULT '[]',
  candidate_responses JSONB DEFAULT '[]',
  communication_score DECIMAL(5,2),
  technical_score DECIMAL(5,2),
  behavioral_score DECIMAL(5,2),
  overall_score DECIMAL(5,2),
  ai_summary TEXT,
  recommendation TEXT,
  recording_url TEXT,
  transcript TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create approval_gates table
CREATE TABLE IF NOT EXISTS approval_gates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  gate_name VARCHAR(100) NOT NULL,
  approved BOOLEAN,
  approved_by UUID,
  decision_date TIMESTAMP DEFAULT NOW(),
  notes TEXT,
  previous_status TEXT,
  new_status TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create email_logs table
CREATE TABLE IF NOT EXISTS email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID REFERENCES applications(id) ON DELETE CASCADE,
  candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  email_type VARCHAR(100) NOT NULL,
  recipient_email VARCHAR(255) NOT NULL,
  subject VARCHAR(500) NOT NULL,
  body TEXT NOT NULL,
  sent_at TIMESTAMP DEFAULT NOW(),
  delivery_status VARCHAR(50) DEFAULT 'sent',
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  template_id UUID,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create email_templates table
CREATE TABLE IF NOT EXISTS email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employer_id UUID REFERENCES employers(id) ON DELETE CASCADE,
  template_type VARCHAR(100) NOT NULL,
  template_name VARCHAR(255) NOT NULL,
  subject VARCHAR(500) NOT NULL,
  html_body TEXT NOT NULL,
  text_body TEXT,
  variables JSONB DEFAULT '[]',
  is_active BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(employer_id, template_type, template_name)
);

-- Create job_board_posts table
CREATE TABLE IF NOT EXISTS job_board_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  board_name VARCHAR(255) NOT NULL,
  post_url TEXT,
  status VARCHAR(50) DEFAULT 'pending',
  published_at TIMESTAMP,
  expires_at TIMESTAMP,
  external_id TEXT,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create bulk_upload_batches table
CREATE TABLE IF NOT EXISTS bulk_upload_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employer_id UUID NOT NULL REFERENCES employers(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  batch_name VARCHAR(255),
  total_files INTEGER NOT NULL DEFAULT 0,
  processed_files INTEGER NOT NULL DEFAULT 0,
  successful_files INTEGER NOT NULL DEFAULT 0,
  failed_files INTEGER NOT NULL DEFAULT 0,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  calibration_data JSONB,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create bulk_upload_items table
CREATE TABLE IF NOT EXISTS bulk_upload_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES bulk_upload_batches(id) ON DELETE CASCADE,
  candidate_id UUID REFERENCES candidates(id) ON DELETE SET NULL,
  application_id UUID REFERENCES applications(id) ON DELETE SET NULL,
  file_name VARCHAR(500) NOT NULL,
  file_size INTEGER,
  file_url TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  raw_score DECIMAL(5,2),
  normalized_score DECIMAL(5,2),
  processing_time_ms INTEGER,
  error_message TEXT,
  resume_text TEXT,
  extracted_data JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  processed_at TIMESTAMP,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create score_calibration_log table
CREATE TABLE IF NOT EXISTS score_calibration_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  batch_id UUID REFERENCES bulk_upload_batches(id) ON DELETE SET NULL,
  calibration_method VARCHAR(100) NOT NULL,
  raw_scores JSONB NOT NULL,
  normalized_scores JSONB NOT NULL,
  statistics JSONB NOT NULL,
  adjustments_applied JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_jobs_employer ON jobs(employer_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_candidates_email ON candidates(email);
CREATE INDEX IF NOT EXISTS idx_applications_job ON applications(job_id);
CREATE INDEX IF NOT EXISTS idx_applications_candidate ON applications(candidate_id);
CREATE INDEX IF NOT EXISTS idx_applications_status ON applications(status);
CREATE INDEX IF NOT EXISTS idx_resume_scores_application ON resume_scores(application_id);
CREATE INDEX IF NOT EXISTS idx_tests_job ON tests(job_id);
CREATE INDEX IF NOT EXISTS idx_tests_employer ON tests(employer_id);
CREATE INDEX IF NOT EXISTS idx_test_attempts_application ON test_attempts(application_id);
CREATE INDEX IF NOT EXISTS idx_ai_interviews_application ON ai_interviews(application_id);
CREATE INDEX IF NOT EXISTS idx_ai_interviews_candidate ON ai_interviews(candidate_id);
CREATE INDEX IF NOT EXISTS idx_ai_interviews_token ON ai_interviews(interview_token);
CREATE INDEX IF NOT EXISTS idx_final_interviews_application ON final_interviews(application_id);
CREATE INDEX IF NOT EXISTS idx_interviews_application ON interviews(application_id);
CREATE INDEX IF NOT EXISTS idx_approval_gates_application ON approval_gates(application_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_candidate ON email_logs(candidate_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_application ON email_logs(application_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_email_type ON email_logs(email_type);
CREATE INDEX IF NOT EXISTS idx_email_logs_delivery_status ON email_logs(delivery_status);
CREATE INDEX IF NOT EXISTS idx_email_templates_employer ON email_templates(employer_id);
CREATE INDEX IF NOT EXISTS idx_email_templates_type ON email_templates(template_type);
CREATE INDEX IF NOT EXISTS idx_job_board_posts_job ON job_board_posts(job_id);
CREATE INDEX IF NOT EXISTS idx_bulk_batches_employer ON bulk_upload_batches(employer_id);
CREATE INDEX IF NOT EXISTS idx_bulk_batches_job ON bulk_upload_batches(job_id);
CREATE INDEX IF NOT EXISTS idx_bulk_items_batch ON bulk_upload_items(batch_id);
CREATE INDEX IF NOT EXISTS idx_calibration_job ON score_calibration_log(job_id);

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Database schema created successfully!';
  RAISE NOTICE 'Total tables created: 17';
  RAISE NOTICE 'Total indexes created: 28';
END $$;
