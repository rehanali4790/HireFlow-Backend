-- Add industry column to email_templates table
ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS industry text DEFAULT 'general';

-- Add is_default column to mark system templates
ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS is_default boolean DEFAULT false;

-- Add template_category column (application_confirmation, test_invitation, interview_invitation, shortlist, rejection)
ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS template_category text;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_email_templates_industry ON email_templates(industry);
CREATE INDEX IF NOT EXISTS idx_email_templates_category ON email_templates(template_category);
CREATE INDEX IF NOT EXISTS idx_email_templates_employer ON email_templates(employer_id);
