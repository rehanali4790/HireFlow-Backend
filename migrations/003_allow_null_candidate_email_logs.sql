-- Allow NULL candidate_id for system emails
ALTER TABLE email_logs 
ALTER COLUMN candidate_id DROP NOT NULL;

-- Add comment
COMMENT ON COLUMN email_logs.candidate_id IS 'Candidate ID - can be NULL for system emails';
