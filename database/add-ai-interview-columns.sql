-- Add missing columns to ai_interviews table for proper functionality

-- Add questions_asked column to store AI questions
ALTER TABLE ai_interviews 
ADD COLUMN IF NOT EXISTS questions_asked jsonb DEFAULT '[]'::jsonb;

-- Add candidate_responses column to store candidate answers
ALTER TABLE ai_interviews 
ADD COLUMN IF NOT EXISTS candidate_responses jsonb DEFAULT '[]'::jsonb;

-- Add problem_solving_score column
ALTER TABLE ai_interviews 
ADD COLUMN IF NOT EXISTS problem_solving_score numeric;

-- Add comments
COMMENT ON COLUMN ai_interviews.questions_asked IS 'Array of questions asked by AI interviewer';
COMMENT ON COLUMN ai_interviews.candidate_responses IS 'Array of candidate responses to questions';
COMMENT ON COLUMN ai_interviews.problem_solving_score IS 'Score for problem-solving abilities (0-100)';
