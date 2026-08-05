require('dotenv').config();
const { createClient } = require('../config/database');

async function createDatabase() {
  if (process.env.DATABASE_URL) {
    console.log('ℹ️ DATABASE_URL is set — Railway/managed Postgres already provides a database.');
    console.log('   Run "npm run db:bootstrap" to create tables and apply migrations.');
    return;
  }

  // Connect to the default 'postgres' database first
  const client = createClient({ database: 'postgres' });

  try {
    await client.connect();
    console.log('🔄 Connected to PostgreSQL...');
    
    // Check if database exists
    const checkDb = await client.query(
      `SELECT 1 FROM pg_database WHERE datname = $1`,
      [process.env.DB_NAME]
    );
    
    if (checkDb.rows.length > 0) {
      console.log(`✅ Database '${process.env.DB_NAME}' already exists!`);
    } else {
      // Create the database
      await client.query(`CREATE DATABASE ${process.env.DB_NAME}`);
      console.log(`✅ Database '${process.env.DB_NAME}' created successfully!`);
    }
    
    console.log('\n📝 Next step: Run "npm run db:setup" to create tables');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

createDatabase();
