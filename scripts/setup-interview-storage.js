/**
 * Setup script for Supabase Storage buckets required for interview functionality
 * Run this script to create the necessary storage buckets and set proper permissions
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Service role key needed for admin operations

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables:');
  console.error('   - VITE_SUPABASE_URL');
  console.error('   - SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function createStorageBuckets() {
  console.log('🚀 Setting up Supabase Storage buckets for interview functionality...\n');

  // Create interview-snapshots bucket
  console.log('📸 Creating interview-snapshots bucket...');
  const { data: snapshotBucket, error: snapshotError } = await supabase.storage
    .createBucket('interview-snapshots', {
      public: false, // Private bucket for security
      fileSizeLimit: 5242880, // 5MB limit
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp']
    });

  if (snapshotError && !snapshotError.message.includes('already exists')) {
    console.error('❌ Failed to create interview-snapshots bucket:', snapshotError.message);
  } else {
    console.log('✅ interview-snapshots bucket created successfully');
  }

  // Set up RLS policies for interview-snapshots bucket
  console.log('🔒 Setting up Row Level Security policies...');
  
  // Policy to allow authenticated users to upload interview snapshots
  const snapshotUploadPolicy = `
    CREATE POLICY "Allow interview snapshot uploads" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'interview-snapshots' AND auth.role() = 'authenticated');
  `;
  
  // Policy to allow authenticated users to read their own interview snapshots
  const snapshotReadPolicy = `
    CREATE POLICY "Allow reading interview snapshots" ON storage.objects
    FOR SELECT USING (bucket_id = 'interview-snapshots' AND auth.role() = 'authenticated');
  `;

  try {
    await supabase.rpc('sql', { query: snapshotUploadPolicy });
    console.log('✅ Upload policy created for interview-snapshots');
  } catch (error) {
    console.log('ℹ️  Upload policy may already exist for interview-snapshots');
  }

  try {
    await supabase.rpc('sql', { query: snapshotReadPolicy });
    console.log('✅ Read policy created for interview-snapshots');
  } catch (error) {
    console.log('ℹ️  Read policy may already exist for interview-snapshots');
  }

  console.log('\n🎉 Storage setup complete!');
  console.log('\n📝 Next steps:');
  console.log('   1. Update the DISABLE_SNAPSHOTS flag in AIInterviewPage.tsx to false');
  console.log('   2. Test the interview flow with snapshot capture enabled');
  console.log('   3. Monitor storage usage in your Supabase dashboard');
}

async function checkStorageStatus() {
  console.log('🔍 Checking current storage bucket status...\n');
  
  const { data: buckets, error } = await supabase.storage.listBuckets();
  
  if (error) {
    console.error('❌ Failed to list buckets:', error.message);
    return;
  }

  const interviewBuckets = buckets.filter(bucket => 
    bucket.name.includes('interview') || bucket.name.includes('snapshot')
  );

  if (interviewBuckets.length === 0) {
    console.log('⚠️  No interview-related storage buckets found');
  } else {
    console.log('📦 Found interview storage buckets:');
    interviewBuckets.forEach(bucket => {
      console.log(`   - ${bucket.name} (${bucket.public ? 'public' : 'private'})`);
    });
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--check')) {
    await checkStorageStatus();
  } else {
    await checkStorageStatus();
    await createStorageBuckets();
  }
}

main().catch(console.error);
