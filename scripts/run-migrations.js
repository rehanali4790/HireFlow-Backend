require('dotenv').config();
const { Pool } = require('pg');
const { runSqlMigrations } = require('./sql-migrations');

async function runMigrations() {
  const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  });

  try {
    console.log('🔄 Running database migrations...\n');
    const results = await runSqlMigrations(pool);

    console.log(`\n✅ Applied ${results.applied.length} migration(s)`);
    if (results.failed.length > 0) {
      console.log(`⚠️ ${results.failed.length} migration(s) reported issues`);
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigrations();
