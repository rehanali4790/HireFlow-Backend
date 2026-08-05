require('dotenv').config();
const { Client } = require('pg');

async function createDatabase() {
  // Connect to the default 'postgres' database first
  const client = new Client({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: 'postgres', // Connect to default database
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  });

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
    
    console.log('\n📝 Next step: Run "npm run setup-db" to create tables');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

createDatabase();
