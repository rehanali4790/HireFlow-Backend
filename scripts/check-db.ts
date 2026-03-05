import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';

dotenv.config();

const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'hireflow_db',
});

async function checkDatabase() {
  try {
    await AppDataSource.initialize();
    console.log('✅ Database connection successful!');
    
    // Check if tables exist
    const tables = await AppDataSource.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    
    console.log('\n📊 Existing tables:');
    if (tables.length === 0) {
      console.log('   No tables found. Set DB_SYNC=true to auto-create tables.');
    } else {
      tables.forEach((table: any) => {
        console.log(`   - ${table.table_name}`);
      });
    }
    
    await AppDataSource.destroy();
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    console.log('\n💡 Troubleshooting:');
    console.log('   1. Check if PostgreSQL is running');
    console.log('   2. Verify database credentials in .env');
    console.log('   3. Ensure database exists: CREATE DATABASE hireflow_db;');
    process.exit(1);
  }
}

checkDatabase();
