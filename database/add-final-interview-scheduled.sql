-- Add final_interview_scheduled_at column to applications table
ALTER TABLE applications 
ADD COLUMN IF NOT EXISTS final_interview_scheduled_at TIMESTAMP;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_applications_final_interview_scheduled 
ON applications(final_interview_scheduled_at);
