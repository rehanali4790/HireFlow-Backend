import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const { Client } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigrations() {
  console.log('🚀 Starting database migration...\n');

  // First, connect to default postgres database to create hireflow_db
  const defaultClient = new Client({
    connectionString: process.env.DATABASE_URL?.replace('/hireflow_db', '/postgres') || 
                     'postgresql://postgres:postgres@localhost:5432/postgres',
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  });

  try {
    await defaultClient.connect();
    console.log('✅ Connected to PostgreSQL server\n');

    // Check if database exists
    const dbCheck = await defaultClient.query(
      "SELECT 1 FROM pg_database WHERE datname = 'hireflow_db'"
    );

    if (dbCheck.rows.length === 0) {
      console.log('📦 Creating hireflow_db database...');
      await defaultClient.query('CREATE DATABASE hireflow_db');
      console.log('✅ Database created successfully\n');
    } else {
      console.log('✅ Database hireflow_db already exists\n');
    }

    await defaultClient.end();
  } catch (error) {
    console.error('❌ Error creating database:', error.message);
    await defaultClient.end();
    process.exit(1);
  }

  // Now connect to hireflow_db to run migrations
  const client = new Client({
    connectionString: process.env.DATABASE_URL || 
                     'postgresql://postgres:postgres@localhost:5432/hireflow_db',
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  });

  try {
    await client.connect();
    console.log('✅ Connected to hireflow_db\n');

    // Get all migration files
    const migrationsDir = path.join(__dirname, '../migrations');
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    console.log(`📁 Found ${files.length} migration files:\n`);

    // Run each migration
    for (const file of files) {
      if (file === '000_create_database.sql') {
        console.log(`⏭️  Skipping ${file} (database already created)\n`);
        continue;
      }

      console.log(`🔄 Running migration: ${file}`);
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf8');

      try {
        await client.query(sql);
        console.log(`✅ Successfully applied: ${file}\n`);
      } catch (error) {
        console.error(`❌ Error in ${file}:`, error.message);
        throw error;
      }
    }

    console.log('🎉 All migrations completed successfully!');
    console.log('\n📊 Database Summary:');
    
    // Get table count
    const tableCount = await client.query(`
      SELECT COUNT(*) as count 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    `);
    console.log(`   Tables: ${tableCount.rows[0].count}`);

    // Get index count
    const indexCount = await client.query(`
      SELECT COUNT(*) as count 
      FROM pg_indexes 
      WHERE schemaname = 'public'
    `);
    console.log(`   Indexes: ${indexCount.rows[0].count}`);

    await client.end();
    console.log('\n✅ Migration complete!');
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    await client.end();
    process.exit(1);
  }
}

runMigrations();
