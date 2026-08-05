// Verify candidates table schema
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

async function verifySchema() {
  try {
    const result = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'candidates'
      ORDER BY ordinal_position
    `);

    console.log('\n📋 Candidates table columns:\n');
    result.rows.forEach(row => {
      console.log(`  - ${row.column_name} (${row.data_type}) ${row.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
    });

    // Check specifically for picture_url
    const hasPictureUrl = result.rows.some(row => row.column_name === 'picture_url');
    
    if (hasPictureUrl) {
      console.log('\n✅ picture_url column exists!');
    } else {
      console.log('\n❌ picture_url column is missing!');
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

verifySchema();
