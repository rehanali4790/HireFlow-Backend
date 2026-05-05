const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

async function runMigration() {
  try {
    console.log('🔄 Running AI interview validity migration...');
    
    // Add columns
    await pool.query(`
      ALTER TABLE ai_interviews 
      ADD COLUMN IF NOT EXISTS valid_from TIMESTAMP,
      ADD COLUMN IF NOT EXISTS valid_until TIMESTAMP;
    `);
    console.log('✅ Added valid_from and valid_until columns');
    
    // Add index
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_ai_interviews_validity 
      ON ai_interviews(valid_from, valid_until);
    `);
    console.log('✅ Added index on validity columns');
    
    // Add comments
    await pool.query(`
      COMMENT ON COLUMN ai_interviews.valid_from IS 'Start date/time when the interview link becomes valid';
    `);
    await pool.query(`
      COMMENT ON COLUMN ai_interviews.valid_until IS 'End date/time when the interview link expires';
    `);
    console.log('✅ Added column comments');
    
    console.log('✅ Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
