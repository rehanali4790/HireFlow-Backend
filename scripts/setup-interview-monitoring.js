const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables:');
  console.error('   - VITE_SUPABASE_URL or REACT_APP_SUPABASE_URL');
  console.error('   - SUPABASE_SERVICE_ROLE_KEY');
  console.error('');
  console.error('Please set these in your .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function setupInterviewMonitoring() {
  console.log('🚀 Setting up interview monitoring system...\n');

  try {
    // Read the SQL setup file
    const sqlPath = path.join(__dirname, '..', 'supabase', 'setup-interview-monitoring.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('📂 Executing setup SQL script...');
    
    // Execute the SQL
    const { data, error } = await supabase.rpc('exec_sql', { sql });
    
    if (error) {
      console.error('❌ Error executing setup script:', error);
      process.exit(1);
    }

    console.log('✅ Interview monitoring setup completed successfully!\n');
    
    // Test the setup by checking if the bucket exists
    console.log('🧪 Testing storage bucket setup...');
    const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();
    
    if (bucketError) {
      console.warn('⚠️ Could not verify bucket setup:', bucketError.message);
    } else {
      const interviewBucket = buckets.find(b => b.id === 'interview-snapshots');
      if (interviewBucket) {
        console.log('✅ interview-snapshots bucket exists and is configured');
        console.log(`   - Public: ${interviewBucket.public}`);
        console.log(`   - File size limit: ${Math.round(interviewBucket.file_size_limit / 1024 / 1024)}MB`);
      } else {
        console.warn('⚠️ interview-snapshots bucket not found - you may need to create it manually');
      }
    }

    // Test monitoring columns
    console.log('\n🧪 Testing database schema...');
    const { data: columns, error: schemaError } = await supabase
      .from('ai_interviews')
      .select('monitoring_enabled, consent_given, snapshots_count')
      .limit(1);
    
    if (schemaError) {
      console.warn('⚠️ Could not verify schema:', schemaError.message);
    } else {
      console.log('✅ Monitoring columns are available in ai_interviews table');
    }

    // Test storage policies
    console.log('\n🧪 Testing storage upload capability...');
    const testFileName = `test-${Date.now()}.txt`;
    const testContent = new Blob(['Test file for interview monitoring setup'], { type: 'text/plain' });
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('interview-snapshots')
      .upload(testFileName, testContent);
    
    if (uploadError) {
      console.warn('⚠️ Storage upload test failed:', uploadError.message);
      console.warn('   This may indicate RLS policy issues - check your Supabase dashboard');
    } else {
      console.log('✅ Storage upload test successful');
      
      // Clean up test file
      await supabase.storage
        .from('interview-snapshots')
        .remove([testFileName]);
      console.log('🧹 Test file cleaned up');
    }

    console.log('\n🎉 Setup complete! Your interview monitoring system is ready.');
    console.log('\n📋 Next steps:');
    console.log('   1. Test the interview flow end-to-end');
    console.log('   2. Verify camera permissions work in your deployment environment');
    console.log('   3. Check that snapshots appear in the employer dashboard');
    console.log('   4. Consider setting up automated cleanup with the provided function');

  } catch (error) {
    console.error('❌ Unexpected error during setup:', error);
    process.exit(1);
  }
}

// Alternative function for direct SQL execution (if rpc doesn't work)
async function setupWithDirectQueries() {
  console.log('🔄 Trying alternative setup method with direct queries...\n');

  try {
    // Create bucket
    console.log('📂 Creating storage bucket...');
    const { error: bucketError } = await supabase.storage.createBucket('interview-snapshots', {
      public: true,
      fileSizeLimit: 5242880, // 5MB
      allowedMimeTypes: ['image/jpeg', 'image/jpg', 'image/png']
    });

    if (bucketError && !bucketError.message.includes('already exists')) {
      console.error('❌ Error creating bucket:', bucketError);
    } else {
      console.log('✅ Storage bucket ready');
    }

    // Add columns to ai_interviews table
    console.log('📊 Adding monitoring columns...');
    const alterQueries = [
      'ALTER TABLE public.ai_interviews ADD COLUMN IF NOT EXISTS monitoring_enabled BOOLEAN DEFAULT true',
      'ALTER TABLE public.ai_interviews ADD COLUMN IF NOT EXISTS consent_given BOOLEAN DEFAULT false',
      'ALTER TABLE public.ai_interviews ADD COLUMN IF NOT EXISTS snapshots_count INTEGER DEFAULT 0'
    ];

    for (const query of alterQueries) {
      const { error } = await supabase.rpc('exec_sql', { sql: query });
      if (error && !error.message.includes('already exists')) {
        console.warn('⚠️ Query warning:', error.message);
      }
    }

    console.log('✅ Database schema updated');
    console.log('\n⚠️ Note: You may need to manually set up RLS policies in the Supabase dashboard');
    console.log('   Go to Storage > interview-snapshots > Policies and ensure public upload/read access');

  } catch (error) {
    console.error('❌ Alternative setup failed:', error);
    process.exit(1);
  }
}

// Run the setup
if (require.main === module) {
  setupInterviewMonitoring().catch(() => {
    console.log('\n🔄 Primary setup failed, trying alternative method...\n');
    setupWithDirectQueries();
  });
}

module.exports = { setupInterviewMonitoring, setupWithDirectQueries };