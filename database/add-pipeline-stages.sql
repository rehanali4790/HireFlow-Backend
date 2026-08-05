-- Add pipeline stage columns to applications table
ALTER TABLE applications
ADD COLUMN IF NOT EXISTS ai_interview_approved_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS video_reviewed_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS video_review_notes TEXT,
ADD COLUMN IF NOT EXISTS final_interview_notes TEXT,
ADD COLUMN IF NOT EXISTS final_interview_rating INTEGER CHECK (final_interview_rating >= 1 AND final_interview_rating <= 5),
ADD COLUMN IF NOT EXISTS offer_extended_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS offer_details JSONB,
ADD COLUMN IF NOT EXISTS offer_accepted_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS hired_at TIMESTAMP;

-- Create offers table for detailed offer management
CREATE TABLE IF NOT EXISTS offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  salary_amount DECIMAL(12, 2),
  salary_currency VARCHAR(10) DEFAULT 'USD',
  start_date DATE,
  position_title VARCHAR(255),
  employment_type VARCHAR(50), -- full-time, part-time, contract
  benefits TEXT,
  additional_notes TEXT,
  status VARCHAR(50) DEFAULT 'pending', -- pending, accepted, rejected, withdrawn
  extended_at TIMESTAMP DEFAULT NOW(),
  responded_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_offers_application_id ON offers(application_id);
CREATE INDEX IF NOT EXISTS idx_applications_ai_interview_approved ON applications(ai_interview_approved_at);
CREATE INDEX IF NOT EXISTS idx_applications_offer_extended ON applications(offer_extended_at);
CREATE INDEX IF NOT EXISTS idx_applications_hired ON applications(hired_at);

-- Update existing applications with hired status to set hired_at
UPDATE applications
SET hired_at = updated_at
WHERE status = 'hired' AND hired_at IS NULL;
