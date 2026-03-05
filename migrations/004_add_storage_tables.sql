-- Create storage tables for file management (replacing Supabase storage)

-- Storage buckets table
CREATE TABLE IF NOT EXISTS storage_buckets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) UNIQUE NOT NULL,
  public BOOLEAN DEFAULT false,
  file_size_limit BIGINT,
  allowed_mime_types TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Storage objects table (files)
CREATE TABLE IF NOT EXISTS storage_objects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_id UUID NOT NULL REFERENCES storage_buckets(id) ON DELETE CASCADE,
  name VARCHAR(500) NOT NULL,
  owner_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_accessed_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  path_tokens TEXT[],
  version VARCHAR(100),
  
  -- File information
  file_path TEXT NOT NULL,
  file_size BIGINT,
  mime_type VARCHAR(255),
  
  UNIQUE(bucket_id, name)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_storage_objects_bucket_id ON storage_objects(bucket_id);
CREATE INDEX IF NOT EXISTS idx_storage_objects_owner_id ON storage_objects(owner_id);
CREATE INDEX IF NOT EXISTS idx_storage_objects_name ON storage_objects(name);

-- Insert default buckets
INSERT INTO storage_buckets (name, public, allowed_mime_types) VALUES
  ('resumes', true, ARRAY['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']),
  ('interview-recordings', false, ARRAY['video/webm', 'video/mp4', 'audio/webm', 'audio/mp4']),
  ('interview-snapshots', false, ARRAY['image/jpeg', 'image/png', 'image/webp']),
  ('company-logos', true, ARRAY['image/jpeg', 'image/png', 'image/svg+xml', 'image/webp'])
ON CONFLICT (name) DO NOTHING;

-- Add comment
COMMENT ON TABLE storage_buckets IS 'Storage buckets for file organization';
COMMENT ON TABLE storage_objects IS 'Stored files and their metadata';
