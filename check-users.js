require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

async function checkUsers() {
  try {
    console.log('🔍 Checking users in database...\n');
    
    const result = await pool.query(
      'SELECT id, contact_email, company_name, created_at FROM employers ORDER BY created_at DESC'
    );
    
    if (result.rows.length === 0) {
      console.log('❌ No users found in database!');
      console.log('\n💡 You need to create a user first.');
      console.log('   Go to http://localhost:5173 and click "Create a free account"\n');
    } else {
      console.log(`✅ Found ${result.rows.length} user(s):\n`);
      result.rows.forEach((user, index) => {
        console.log(`${index + 1}. Email: ${user.contact_email}`);
        console.log(`   Company: ${user.company_name}`);
        console.log(`   ID: ${user.id}`);
        console.log(`   Created: ${user.created_at}`);
        console.log('');
      });
    }
    
    await pool.end();
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkUsers();
