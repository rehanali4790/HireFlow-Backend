require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { createPool } = require('../config/database');

async function setupDatabase() {
  const pool = createPool();

  try {
    console.log('🔄 Setting up database...');
    
    // Read schema file
    const schemaPath = path.join(__dirname, '../database/schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    // Execute schema
    await pool.query(schema);
    
    console.log('✅ Database setup complete!');
    console.log('\nTables created:');
    console.log('  - employers');
    console.log('  - jobs');
    console.log('  - candidates');
    console.log('  - applications');
    console.log('  - resume_scores');
    console.log('  - tests');
    console.log('  - test_attempts');
    console.log('  - ai_interviews');
    console.log('  - final_interviews');
    console.log('  - approval_gates');
    console.log('  - email_logs');
    
  } catch (error) {
    console.error('❌ Database setup failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

setupDatabase();
