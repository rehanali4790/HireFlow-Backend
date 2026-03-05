-- Disable Row Level Security (RLS) for all tables
-- Since we're using PostgreSQL directly (not Supabase), we don't need RLS

-- Disable RLS on all tables
ALTER TABLE employers DISABLE ROW LEVEL SECURITY;
ALTER TABLE jobs DISABLE ROW LEVEL SECURITY;
ALTER TABLE candidates DISABLE ROW LEVEL SECURITY;
ALTER TABLE applications DISABLE ROW LEVEL SECURITY;
ALTER TABLE resume_scores DISABLE ROW LEVEL SECURITY;
ALTER TABLE tests DISABLE ROW LEVEL SECURITY;
ALTER TABLE test_attempts DISABLE ROW LEVEL SECURITY;
ALTER TABLE ai_interviews DISABLE ROW LEVEL SECURITY;
ALTER TABLE final_interviews DISABLE ROW LEVEL SECURITY;
ALTER TABLE interviews DISABLE ROW LEVEL SECURITY;
ALTER TABLE approval_gates DISABLE ROW LEVEL SECURITY;
ALTER TABLE email_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE email_templates DISABLE ROW LEVEL SECURITY;
ALTER TABLE job_board_posts DISABLE ROW LEVEL SECURITY;
ALTER TABLE bulk_upload_batches DISABLE ROW LEVEL SECURITY;
ALTER TABLE bulk_upload_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE score_calibration_log DISABLE ROW LEVEL SECURITY;
ALTER TABLE storage_buckets DISABLE ROW LEVEL SECURITY;
ALTER TABLE storage_objects DISABLE ROW LEVEL SECURITY;

-- Drop any existing RLS policies
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT schemaname, tablename, policyname 
              FROM pg_policies 
              WHERE schemaname = 'public') 
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', 
                      r.policyname, r.schemaname, r.tablename);
    END LOOP;
END $$;

-- Verify RLS is disabled
SELECT 
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY tablename;
