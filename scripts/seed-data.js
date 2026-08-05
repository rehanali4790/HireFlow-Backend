require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcrypt');

async function seedData() {
  const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  });

  try {
    console.log('🔄 Seeding demo data...');
    
    // Create demo employer
    const passwordHash = await bcrypt.hash('demo123', 10);
    const employerResult = await pool.query(
      `INSERT INTO employers (
        company_name, contact_email, password_hash,
        company_description, industry, company_size,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
      RETURNING id`,
      [
        'Demo Company',
        'demo@hireflow.com',
        passwordHash,
        'A demo company for testing HireFlow',
        'Technology',
        '50-100'
      ]
    );
    
    const employerId = employerResult.rows[0].id;
    console.log('✅ Created demo employer');
    console.log('   Email: demo@hireflow.com');
    console.log('   Password: demo123');
    
    // Create demo jobs
    const jobResult = await pool.query(
      `INSERT INTO jobs (
        employer_id, title, description, requirements,
        skills_required, location, work_type, remote_policy,
        salary_min, salary_max, salary_currency,
        experience_level, status, positions_available,
        created_at, updated_at
      ) VALUES 
        ($1, 'Software Engineer', 'We are looking for a talented software engineer...', 
         '3+ years of experience', ARRAY['JavaScript', 'React', 'Node.js'], 
         'San Francisco, CA', 'full-time', 'hybrid', 100000, 150000, 'USD',
         'mid', 'active', 2, NOW(), NOW()),
        ($1, 'Product Manager', 'Seeking an experienced product manager...', 
         '5+ years of experience', ARRAY['Product Management', 'Agile', 'Analytics'], 
         'New York, NY', 'full-time', 'remote', 120000, 180000, 'USD',
         'senior', 'active', 1, NOW(), NOW())
      RETURNING id`,
      [employerId]
    );
    
    console.log(`✅ Created ${jobResult.rows.length} demo jobs`);
    
    // Create demo candidate
    const candidateResult = await pool.query(
      `INSERT INTO candidates (
        email, first_name, last_name, phone, location,
        skills, experience_years, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
      RETURNING id`,
      [
        'john.doe@example.com',
        'John',
        'Doe',
        '+1234567890',
        'San Francisco, CA',
        ['JavaScript', 'React', 'Node.js', 'Python'],
        5
      ]
    );
    
    const candidateId = candidateResult.rows[0].id;
    console.log('✅ Created demo candidate');
    
    // Create demo application
    await pool.query(
      `INSERT INTO applications (
        job_id, candidate_id, status, current_stage,
        application_date, created_at, updated_at
      ) VALUES ($1, $2, 'applied', 'application_received', NOW(), NOW(), NOW())`,
      [jobResult.rows[0].id, candidateId]
    );
    
    console.log('✅ Created demo application');
    
    console.log('\n🎉 Demo data seeded successfully!');
    console.log('\nYou can now login with:');
    console.log('  Email: demo@hireflow.com');
    console.log('  Password: demo123');
    
  } catch (error) {
    console.error('❌ Seeding failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seedData();
