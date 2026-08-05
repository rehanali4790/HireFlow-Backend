-- Add question_count column to ai_interviews table
ALTER TABLE ai_interviews 
ADD COLUMN IF NOT EXISTS question_count INTEGER DEFAULT 5;

-- Add comment
COMMENT ON COLUMN ai_interviews.question_count IS 'Number of questions AI will ask during the interview';

-- Update existing records to have default value
UPDATE ai_interviews 
SET question_count = 5 
WHERE question_count IS NULL;
