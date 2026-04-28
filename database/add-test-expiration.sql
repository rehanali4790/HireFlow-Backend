-- Add test link expiration tracking
-- This allows test links to expire after 24 hours and be extended by HR

-- Add columns to test_attempts table
ALTER TABLE test_attempts 
ADD COLUMN IF NOT EXISTS link_sent_at timestamptz,
ADD COLUMN IF NOT EXISTS link_expires_at timestamptz,
ADD COLUMN IF NOT EXISTS link_extended_at timestamptz,
ADD COLUMN IF NOT EXISTS extension_reason text,
ADD COLUMN IF NOT EXISTS is_expired boolean DEFAULT false;

-- Create index for faster expiration checks
CREATE INDEX IF NOT EXISTS idx_test_attempts_expires_at ON test_attempts(link_expires_at);
CREATE INDEX IF NOT EXISTS idx_test_attempts_application ON test_attempts(application_id);

-- Update existing records to set expiration (24 hours from creation)
UPDATE test_attempts 
SET 
  link_sent_at = created_at,
  link_expires_at = created_at + INTERVAL '24 hours',
  is_expired = (NOW() > created_at + INTERVAL '24 hours')
WHERE link_sent_at IS NULL;

COMMENT ON COLUMN test_attempts.link_sent_at IS 'When the test link was sent to candidate';
COMMENT ON COLUMN test_attempts.link_expires_at IS 'When the test link expires (24 hours by default)';
COMMENT ON COLUMN test_attempts.link_extended_at IS 'When HR extended the test link';
COMMENT ON COLUMN test_attempts.extension_reason IS 'Reason for extending the test link';
COMMENT ON COLUMN test_attempts.is_expired IS 'Whether the test link has expired';
