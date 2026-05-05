require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcrypt');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

async function resetPassword() {
  const email = 'mohammadammaz737@gmail.com';
  const newPassword = 'password123';
  
  try {
    console.log('🔐 Resetting password for:', email);
    console.log('🔑 New password will be:', newPassword);
    
    // Hash the new password
    const passwordHash = await bcrypt.hash(newPassword, 10);
    
    // Update the password
    const result = await pool.query(
      'UPDATE employers SET password_hash = $1, updated_at = NOW() WHERE contact_email = $2 RETURNING id, contact_email, company_name',
      [passwordHash, email]
    );
    
    if (result.rows.length === 0) {
      console.log('❌ User not found!');
    } else {
      console.log('\n✅ Password reset successful!');
      console.log('   Email:', result.rows[0].contact_email);
      console.log('   Company:', result.rows[0].company_name);
      console.log('   New Password:', newPassword);
      console.log('\n💡 You can now login with these credentials\n');
    }
    
    await pool.end();
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

resetPassword();
