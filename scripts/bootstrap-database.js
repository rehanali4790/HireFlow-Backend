require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { createPool } = require('../config/database');
const { runSqlMigrations } = require('./sql-migrations');

async function ensureBaseSchema(pool) {
  const result = await pool.query(`
    SELECT EXISTS (
      SELECT FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'employers'
    ) AS exists
  `);

  if (result.rows[0].exists) {
    return false;
  }

  const schemaPath = path.join(__dirname, '../database/schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf8');
  await pool.query(schema);
  console.log('✅ Base schema created');
  return true;
}

async function bootstrapDatabase(pool, options = {}) {
  const log = options.log || console.log;
  const warn = options.warn || console.warn;

  await pool.query('SELECT NOW()');
  log('✅ Database connected successfully');

  await pool.query('CREATE EXTENSION IF NOT EXISTS pgcrypto');
  await ensureBaseSchema(pool);
  await runSqlMigrations(pool, { log, warn });
}

async function runBootstrapCli() {
  const pool = createPool();

  try {
    console.log('🔄 Bootstrapping database...\n');
    await bootstrapDatabase(pool);
    console.log('\n✅ Database bootstrap complete');
  } catch (error) {
    console.error('❌ Database bootstrap failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  runBootstrapCli();
}

module.exports = {
  bootstrapDatabase,
  ensureBaseSchema,
};
