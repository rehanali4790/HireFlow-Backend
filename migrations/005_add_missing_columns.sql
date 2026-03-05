-- Add any missing columns that the frontend expects

-- Ensure candidates table has all needed columns
DO $$ 
BEGIN
  -- Add resume_text column if it doesn't exist (for parsed resume content)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='candidates' AND column_name='resume_text') THEN
    ALTER TABLE candidates ADD COLUMN resume_text TEXT;
  END IF;
  
  -- Add profile_picture_url if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='candidates' AND column_name='profile_picture_url') THEN
    ALTER TABLE candidates ADD COLUMN profile_picture_url TEXT;
  END IF;
END $$;

-- Ensure applications table has all needed columns
DO $$ 
BEGIN
  -- Add resume_file_path column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='applications' AND column_name='resume_file_path') THEN
    ALTER TABLE applications ADD COLUMN resume_file_path TEXT;
  END IF;
  
  -- Add resume_storage_id column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='applications' AND column_name='resume_storage_id') THEN
    ALTER TABLE applications ADD COLUMN resume_storage_id UUID REFERENCES storage_objects(id);
  END IF;
END $$;

-- Ensure employers table has all needed columns
DO $$ 
BEGIN
  -- Add logo_storage_id if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='employers' AND column_name='logo_storage_id') THEN
    ALTER TABLE employers ADD COLUMN logo_storage_id UUID REFERENCES storage_objects(id);
  END IF;
END $$;

-- Add comments
COMMENT ON COLUMN candidates.resume_text IS 'Extracted text content from resume for searching';
COMMENT ON COLUMN candidates.profile_picture_url IS 'URL to candidate profile picture';
COMMENT ON COLUMN applications.resume_file_path IS 'File system path to uploaded resume';
COMMENT ON COLUMN applications.resume_storage_id IS 'Reference to storage_objects for resume file';
COMMENT ON COLUMN employers.logo_storage_id IS 'Reference to storage_objects for company logo';
