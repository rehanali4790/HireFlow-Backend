require('dotenv').config();
const { createPool } = require('../config/database');
const { bootstrapDatabase } = require('./bootstrap-database');
const bcrypt = require('bcrypt');

async function seedData() {
  const pool = createPool();

  try {
    console.log('🔄 Preparing database...');
    await bootstrapDatabase(pool);

    console.log('🔄 Seeding demo data...');

    const existingEmployer = await pool.query(
      'SELECT id FROM employers WHERE contact_email = $1 LIMIT 1',
      ['demo@hireflow.com']
    );

    let employerId;

    if (existingEmployer.rows.length > 0) {
      employerId = existingEmployer.rows[0].id;
      console.log('ℹ️ Demo employer already exists — skipping employer creation');
    } else {
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
          '50-100',
        ]
      );

      employerId = employerResult.rows[0].id;
      console.log('✅ Created demo employer');
    }

    console.log('   Email: demo@hireflow.com');
    console.log('   Password: demo123');

    const existingJobs = await pool.query(
      'SELECT id FROM jobs WHERE employer_id = $1 LIMIT 1',
      [employerId]
    );

    let jobIds = [];

    if (existingJobs.rows.length > 0) {
      const jobs = await pool.query('SELECT id FROM jobs WHERE employer_id = $1 ORDER BY created_at ASC', [employerId]);
      jobIds = jobs.rows.map((row) => row.id);
      console.log(`ℹ️ Demo jobs already exist (${jobIds.length}) — skipping job creation`);
    } else {
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

      jobIds = jobResult.rows.map((row) => row.id);
      console.log(`✅ Created ${jobIds.length} demo jobs`);
    }

    let candidateId;
    const existingCandidate = await pool.query(
      'SELECT id FROM candidates WHERE email = $1 LIMIT 1',
      ['john.doe@example.com']
    );

    if (existingCandidate.rows.length > 0) {
      candidateId = existingCandidate.rows[0].id;
      console.log('ℹ️ Demo candidate already exists — skipping candidate creation');
    } else {
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
          5,
        ]
      );

      candidateId = candidateResult.rows[0].id;
      console.log('✅ Created demo candidate');
    }

    if (jobIds.length > 0) {
      const existingApplication = await pool.query(
        'SELECT id FROM applications WHERE job_id = $1 AND candidate_id = $2 LIMIT 1',
        [jobIds[0], candidateId]
      );

      if (existingApplication.rows.length > 0) {
        console.log('ℹ️ Demo application already exists — skipping application creation');
      } else {
        await pool.query(
          `INSERT INTO applications (
            job_id, candidate_id, status, current_stage,
            application_date, created_at, updated_at
          ) VALUES ($1, $2, 'applied', 'application_received', NOW(), NOW(), NOW())`,
          [jobIds[0], candidateId]
        );
        console.log('✅ Created demo application');
      }
    }

    console.log('\n🎉 Demo data ready!');
    console.log('\nLogin with:');
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
