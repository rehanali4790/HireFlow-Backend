/**
 * Verify Resume Storage Setup
 * 
 * This script helps verify that your Supabase resume storage bucket is properly configured.
 * Run this to troubleshoot bucket issues.
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // You need to add this to .env

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables');
  console.log('Please add VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to your .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function verifyResumeStorage() {
  console.log('🔍 Verifying Resume Storage Setup...\n');

  try {
    // 1. Check if bucket exists
    console.log('1. Checking bucket existence...');
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    
    if (listError) {
      console.error('❌ Error listing buckets:', listError);
      return;
    }

    const resumeBucket = buckets.find(bucket => bucket.name === 'resume');
    if (!resumeBucket) {
      console.error('❌ Resume bucket not found!');
      console.log('💡 Please create the resume bucket in your Supabase dashboard:');
      console.log('   - Go to Storage > Create new bucket');
      console.log('   - Name: "resume"');
      console.log('   - Public: false (private)');
      console.log('   - File size limit: 5242880 (5MB)');
      console.log('   - Allowed MIME types: application/pdf');
      return;
    }
    
    console.log('✅ Resume bucket found');
    console.log(`   - Name: ${resumeBucket.name}`);
    console.log(`   - Public: ${resumeBucket.public ? 'Yes' : 'No'}`);
    console.log(`   - Created: ${resumeBucket.created_at}`);

    // 2. Test bucket access
    console.log('\n2. Testing bucket access...');
    const { data: files, error: listFilesError } = await supabase.storage
      .from('resume')
      .list('', { limit: 10 });

    if (listFilesError) {
      console.error('❌ Error accessing bucket:', listFilesError);
      console.log('💡 This might indicate missing RLS policies');
    } else {
      console.log(`✅ Bucket accessible (${files.length} files found)`);
    }

    // 3. Check policies
    console.log('\n3. Storage policies should be configured as:');
    console.log('   a) Allow public resume uploads during application');
    console.log('   b) Allow employers to read resumes for their applications');
    console.log('   c) Allow service role full access to resumes');
    console.log('\n💡 If downloads still fail, verify these policies exist in Database > Policies');

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

// Test with sample file operations
async function testFileOperations() {
  console.log('\n🧪 Testing File Operations...\n');

  try {
    // Create a small test file
    const testContent = 'This is a test file for resume storage verification';
    const testFile = new Blob([testContent], { type: 'text/plain' });
    const testFileName = `test-${Date.now()}.txt`;

    // 1. Test upload
    console.log('1. Testing upload...');
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('resume')
      .upload(testFileName, testFile);

    if (uploadError) {
      console.error('❌ Upload failed:', uploadError);
      return;
    }
    console.log('✅ Upload successful:', uploadData.path);

    // 2. Test download
    console.log('2. Testing download...');
    const { data: downloadData, error: downloadError } = await supabase.storage
      .from('resume')
      .download(testFileName);

    if (downloadError) {
      console.error('❌ Download failed:', downloadError);
    } else {
      console.log('✅ Download successful');
    }

    // 3. Test signed URL
    console.log('3. Testing signed URL...');
    const { data: signedData, error: signedError } = await supabase.storage
      .from('resume')
      .createSignedUrl(testFileName, 60);

    if (signedError) {
      console.error('❌ Signed URL failed:', signedError);
    } else {
      console.log('✅ Signed URL created:', signedData.signedUrl);
    }

    // 4. Cleanup test file
    console.log('4. Cleaning up test file...');
    const { error: deleteError } = await supabase.storage
      .from('resume')
      .remove([testFileName]);

    if (deleteError) {
      console.error('❌ Cleanup failed:', deleteError);
    } else {
      console.log('✅ Cleanup successful');
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run verification
async function main() {
  await verifyResumeStorage();
  await testFileOperations();
  
  console.log('\n🎉 Verification complete!');
  console.log('\nIf you see any ❌ errors above, please:');
  console.log('1. Check your Supabase project settings');
  console.log('2. Ensure the resume bucket exists and is configured correctly');
  console.log('3. Verify RLS policies are set up as described in supabase/STORAGE_SETUP.md');
}

main().catch(console.error);