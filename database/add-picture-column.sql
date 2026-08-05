-- Add picture_url column to candidates table
-- Run this migration to add support for candidate profile pictures

-- Add the column if it doesn't exist
ALTER TABLE candidates 
ADD COLUMN IF NOT EXISTS picture_url TEXT;

-- Verify the column was added
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'candidates' AND column_name = 'picture_url';

-- Show success message
DO $$
BEGIN
  RAISE NOTICE 'Successfully added picture_url column to candidates table';
END $$;
