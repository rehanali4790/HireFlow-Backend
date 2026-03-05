/**
 * Setup Supabase Storage Bucket for Resume PDFs
 * 
 * This script creates the storage bucket and policies for resume uploads.
 * Run this once to set up the storage infrastructure.
 */

import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env file manually
const envPath = resolve(__dirname, '..', '.env');
const envContent = readFileSync(envPath, 'utf8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    envVars[match[1].trim()] = match[2].trim();
  }
});

const supabaseUrl = envVars.VITE_SUPABASE_URL;
const supabaseServiceKey = envVars.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables:');
  console.error('   - VITE_SUPABASE_URL');
  console.error('   - SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function setupResumeStorage() {
  console.log('🚀 Setting up resume storage bucket...\n');

  try {
    // Check if bucket already exists
    const { data: existingBuckets, error: listError } = await supabase.storage.listBuckets();
    
    if (listError) {
      throw new Error(`Failed to list buckets: ${listError.message}`);
    }

    const bucketExists = existingBuckets?.some(bucket => bucket.name === 'resumes');

    if (bucketExists) {
      console.log('✅ Storage bucket "resumes" already exists');
    } else {
      // Create the bucket
      const { data: newBucket, error: createError } = await supabase.storage.createBucket('resumes', {
        public: false,
        fileSizeLimit: 5242880, // 5MB in bytes
        allowedMimeTypes: ['application/pdf']
      });

      if (createError) {
        throw new Error(`Failed to create bucket: ${createError.message}`);
      }

      console.log('✅ Storage bucket "resumes" created successfully');
    }

    // Read and execute the SQL policies
    console.log('\n📝 Setting up storage policies...');
    const sqlPath = resolve(__dirname, '..', 'supabase', 'setup-resume-storage.sql');
    const sql = readFileSync(sqlPath, 'utf8');

    // Split SQL into individual statements (skip the INSERT bucket statement as we did it via API)
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s && !s.startsWith('--') && !s.includes('INSERT INTO storage.buckets'));

    for (const statement of statements) {
      if (statement.length > 0) {
        const { error: policyError } = await supabase.rpc('exec_sql', { 
          sql: statement + ';' 
        });

        if (policyError && !policyError.message.includes('already exists')) {
          console.warn(`⚠️  Warning: ${policyError.message}`);
        }
      }
    }

    console.log('✅ Storage policies configured');

    console.log('\n✨ Resume storage setup complete!');
    console.log('\n📋 Summary:');
    console.log('   • Bucket: resumes (private)');
    console.log('   • Max file size: 5MB');
    console.log('   • Allowed types: PDF only');
    console.log('   • Public uploads: Enabled (for applications)');
    console.log('   • Employer access: Restricted to their job applications');

  } catch (error) {
    console.error('\n❌ Error setting up resume storage:', error.message);
    process.exit(1);
  }
}

// Run the setup
setupResumeStorage();

