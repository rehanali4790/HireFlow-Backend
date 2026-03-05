-- Add auth columns to employers table
ALTER TABLE employers ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE employers ADD COLUMN IF NOT EXISTS auth_token TEXT;

-- Allow null candidate_id in email_logs (for system emails)
ALTER TABLE email_logs ALTER COLUMN candidate_id DROP NOT NULL;

-- Add body_html alias column if email_templates uses html_body
-- (some code references body_html, schema has html_body - ensure consistency)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'email_templates' AND column_name = 'body_html'
  ) THEN
    ALTER TABLE email_templates ADD COLUMN body_html TEXT;
    UPDATE email_templates SET body_html = html_body WHERE body_html IS NULL;
  END IF;
END $$;
