// Migration script to add picture_url column to candidates table
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
  console.log('🔄 Running migration: Add picture_url column to candidates table\n');

  try {
    // Read the SQL file
    const sqlPath = path.join(__dirname, 'add-picture-column.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    // Execute the migration
    console.log('Executing SQL migration...');
    await pool.query(sql);

    // Verify the column exists
    const result = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'candidates' AND column_name = 'picture_url'
    `);

    if (result.rows.length > 0) {
      console.log('\n✅ Migration successful!');
      console.log('Column details:', result.rows[0]);
      console.log('\nThe candidates table now has a picture_url column.');
    } else {
      console.log('\n❌ Migration failed: Column not found after migration');
    }

  } catch (error) {
    console.error('\n❌ Migration error:', error.message);
    console.error('Details:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
