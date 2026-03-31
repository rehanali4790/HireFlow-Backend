-- Add certifications column to candidates table
ALTER TABLE candidates 
ADD COLUMN IF NOT EXISTS certifications text[] DEFAULT ARRAY[]::text[];

-- Add comment
COMMENT ON COLUMN candidates.certifications IS 'Array of professional certifications and credentials';
