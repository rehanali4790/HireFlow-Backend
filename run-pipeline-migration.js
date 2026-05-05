const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'hireflow',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

async function runMigration() {
  const client = await pool.connect();
  
  try {
    console.log('🚀 Starting pipeline stages migration...');
    
    const migrationSQL = fs.readFileSync(
      path.join(__dirname, 'database', 'add-pipeline-stages.sql'),
      'utf8'
    );
    
    await client.query(migrationSQL);
    
    console.log('✅ Pipeline stages migration completed successfully!');
    console.log('📊 Added columns:');
    console.log('   - ai_interview_approved_at');
    console.log('   - video_reviewed_at');
    console.log('   - video_review_notes');
    console.log('   - final_interview_notes');
    console.log('   - final_interview_rating');
    console.log('   - offer_extended_at');
    console.log('   - offer_details');
    console.log('   - offer_accepted_at');
    console.log('   - hired_at');
    console.log('📋 Created offers table for offer management');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
