/**
 * Run test expiration migration
 * This adds expiration tracking to test_attempts table
 */

require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

async function runMigration() {
  try {
    console.log('🔄 Running test expiration migration...\n');

    // Read the SQL file
    const sqlPath = path.join(__dirname, 'database', 'add-test-expiration.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    // Execute the migration
    await pool.query(sql);

    console.log('✅ Migration completed successfully!\n');
    console.log('Added columns to test_attempts table:');
    console.log('  - link_sent_at');
    console.log('  - link_expires_at');
    console.log('  - link_extended_at');
    console.log('  - extension_reason');
    console.log('  - is_expired\n');

    // Verify the migration
    const result = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'test_attempts' 
      AND column_name IN ('link_sent_at', 'link_expires_at', 'link_extended_at', 'extension_reason', 'is_expired')
      ORDER BY column_name
    `);

    console.log('✅ Verification - Columns added:');
    result.rows.forEach(row => {
      console.log(`  - ${row.column_name} (${row.data_type})`);
    });

    console.log('\n✅ Test link expiration feature is ready!');
    console.log('\nNext steps:');
    console.log('1. Restart the backend server: npm run dev');
    console.log('2. Test links will now expire after 24 hours');
    console.log('3. HR can extend links from the Approvals page\n');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    
    if (error.message.includes('already exists')) {
      console.log('\n⚠️  Columns already exist - migration may have been run before.');
      console.log('This is not an error. The feature should work correctly.\n');
    } else {
      console.error('\nError details:', error);
    }
  } finally {
    await pool.end();
  }
}

// Run the migration
runMigration();
