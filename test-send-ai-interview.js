require('dotenv').config();
const { Pool } = require('pg');
const emailService = require('./services/email-service');
const { v4: uuidv4 } = require('uuid');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

async function testSendAIInterview() {
  console.log('🧪 Testing AI Interview Invitation\n');
  
  try {
    // Get the first application
    console.log('🔍 Finding an application...');
    const appResult = await pool.query(`
      SELECT a.*, 
             c.first_name, c.last_name, c.email,
             j.title as job_title
      FROM applications a
      LEFT JOIN candidates c ON a.candidate_id = c.id
      LEFT JOIN jobs j ON a.job_id = j.id
      ORDER BY a.created_at DESC
      LIMIT 1
    `);
    
    if (appResult.rows.length === 0) {
      console.log('❌ No applications found in database');
      console.log('   Please submit an application first');
      return;
    }
    
    const application = appResult.rows[0];
    console.log('✅ Application found:');
    console.log('   Candidate:', `${application.first_name} ${application.last_name}`);
    console.log('   Email:', application.email);
    console.log('   Job:', application.job_title);
    console.log('');
    
    // Check if AI interview already exists
    const existingInterview = await pool.query(
      'SELECT id, interview_token FROM ai_interviews WHERE application_id = $1',
      [application.id]
    );
    
    let interviewToken;
    
    if (existingInterview.rows.length > 0) {
      interviewToken = existingInterview.rows[0].interview_token;
      console.log('♻️  Reusing existing interview token');
    } else {
      // Create AI interview record
      interviewToken = uuidv4();
      console.log('🆕 Creating new interview record...');
      
      await pool.query(
        `INSERT INTO ai_interviews (
          application_id, interview_token, created_at, updated_at
        ) VALUES ($1, $2, NOW(), NOW())`,
        [application.id, interviewToken]
      );
      console.log('✅ Interview record created');
    }
    
    // Generate interview link
    const interviewLink = `${process.env.APP_URL}/interview/${interviewToken}`;
    console.log('🔗 Interview link:', interviewLink);
    console.log('');
    
    // Send email
    console.log('📧 Sending AI interview invitation email...');
    await emailService.sendAIInterviewInvitation(
      application.email,
      `${application.first_name} ${application.last_name}`,
      application.job_title,
      interviewLink
    );
    
    console.log('✅ Email sent successfully!');
    console.log('');
    console.log('📬 Check inbox:', application.email);
    console.log('📝 Subject: 🎤 AI Interview Invitation -', application.job_title);
    console.log('');
    console.log('🎉 Test completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('');
    console.error('Full error:', error);
  } finally {
    await pool.end();
  }
}

testSendAIInterview();
