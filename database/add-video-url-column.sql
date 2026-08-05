-- Add video_url column to ai_interviews table
ALTER TABLE ai_interviews 
ADD COLUMN IF NOT EXISTS video_url text;

-- Add comment
COMMENT ON COLUMN ai_interviews.video_url IS 'URL to the recorded interview video';
