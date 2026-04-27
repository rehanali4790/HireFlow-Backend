require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function runMigrations() {
  const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  });

  try {
    console.log('🔄 Running database migrations...');
    
    // Run certifications migration
    const certMigration = path.join(__dirname, '../database/add-certifications-column.sql');
    if (fs.existsSync(certMigration)) {
      const sql = fs.readFileSync(certMigration, 'utf8');
      await pool.query(sql);
      console.log('✅ Added certifications column');
    }
    
    // Run picture migration
    const pictureMigration = path.join(__dirname, '../database/add-picture-column.sql');
    if (fs.existsSync(pictureMigration)) {
      const sql = fs.readFileSync(pictureMigration, 'utf8');
      await pool.query(sql);
      console.log('✅ Added picture_url column');
    }
    
    // Run test columns migration
    const testMigration = path.join(__dirname, '../database/add-test-columns.sql');
    if (fs.existsSync(testMigration)) {
      const sql = fs.readFileSync(testMigration, 'utf8');
      await pool.query(sql);
      console.log('✅ Added test columns (status, ai_evaluation_enabled, is_ai_generated)');
    }
    
    // Run AI interview columns migration
    const aiInterviewMigration = path.join(__dirname, '../database/add-ai-interview-columns.sql');
    if (fs.existsSync(aiInterviewMigration)) {
      const sql = fs.readFileSync(aiInterviewMigration, 'utf8');
      await pool.query(sql);
      console.log('✅ Added AI interview columns (questions_asked, candidate_responses, problem_solving_score)');
    }
    
    // Run video URL migration
    const videoUrlMigration = path.join(__dirname, '../database/add-video-url-column.sql');
    if (fs.existsSync(videoUrlMigration)) {
      const sql = fs.readFileSync(videoUrlMigration, 'utf8');
      await pool.query(sql);
      console.log('✅ Added video_url column to ai_interviews');
    }
    
    console.log('\n✅ All migrations completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigrations();
