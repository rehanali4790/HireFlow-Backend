const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function runMigration() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log('🔄 Running email template migration...');
    
    const migrationSQL = fs.readFileSync(
      path.join(__dirname, 'database', 'add-email-template-industry.sql'),
      'utf8'
    );

    await pool.query(migrationSQL);
    
    console.log('✅ Email template migration completed successfully!');
    console.log('');
    console.log('📧 Email template features added:');
    console.log('   - Industry-specific email templates');
    console.log('   - Template categories (application, test, interview, etc.)');
    console.log('   - Default template support');
    console.log('');
    console.log('🎨 Available industries:');
    console.log('   - Technology');
    console.log('   - Healthcare');
    console.log('   - Finance');
    console.log('   - Education');
    console.log('   - Retail');
    console.log('   - Manufacturing');
    console.log('   - Consulting');
    console.log('   - Other');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

runMigration()
  .then(() => {
    console.log('');
    console.log('✨ All done! You can now use industry-specific email templates.');
    console.log('💡 Go to Settings > Email Templates to select your industry.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed to run migration:', error);
    process.exit(1);
  });
