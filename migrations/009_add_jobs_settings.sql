-- Add settings column to jobs table
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}'::jsonb;
