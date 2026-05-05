-- Add validity date columns to ai_interviews table
ALTER TABLE ai_interviews 
ADD COLUMN IF NOT EXISTS valid_from TIMESTAMP,
ADD COLUMN IF NOT EXISTS valid_until TIMESTAMP;

-- Add index for faster queries on validity dates
CREATE INDEX IF NOT EXISTS idx_ai_interviews_validity 
ON ai_interviews(valid_from, valid_until);

-- Add comment
COMMENT ON COLUMN ai_interviews.valid_from IS 'Start date/time when the interview link becomes valid';
COMMENT ON COLUMN ai_interviews.valid_until IS 'End date/time when the interview link expires';
