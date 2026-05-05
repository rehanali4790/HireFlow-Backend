const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

async function checkInterview() {
  const token = process.argv[2];
  
  if (!token) {
    console.log('Usage: node check-interview.js <interview_token>');
    console.log('\nRecent interviews:');
    const recent = await pool.query('SELECT interview_token, started_at, completed_at, question_count FROM ai_interviews ORDER BY created_at DESC LIMIT 5');
    recent.rows.forEach(row => {
      console.log(`\nToken: ${row.interview_token}`);
      console.log(`Started: ${row.started_at}`);
      console.log(`Completed: ${row.completed_at}`);
      console.log(`Question Count: ${row.question_count}`);
    });
    process.exit(0);
  }
  
  try {
    const result = await pool.query(
      'SELECT * FROM ai_interviews WHERE interview_token = $1',
      [token]
    );
    
    if (result.rows.length === 0) {
      console.log('❌ Interview not found');
      process.exit(1);
    }
    
    const interview = result.rows[0];
    console.log('\n📋 Interview Details:');
    console.log('Token:', interview.interview_token);
    console.log('Application ID:', interview.application_id);
    console.log('Question Count Setting:', interview.question_count);
    console.log('Started At:', interview.started_at);
    console.log('Completed At:', interview.completed_at);
    console.log('Questions Asked:', interview.questions_asked ? interview.questions_asked.length : 0);
    console.log('Candidate Responses:', interview.candidate_responses ? interview.candidate_responses.length : 0);
    
    if (interview.questions_asked && interview.questions_asked.length > 0) {
      console.log('\n📝 Questions:');
      interview.questions_asked.forEach((q, i) => {
        console.log(`  ${i + 1}. ${q.message.substring(0, 80)}...`);
      });
    }
    
    if (interview.candidate_responses && interview.candidate_responses.length > 0) {
      console.log('\n💬 Responses:');
      interview.candidate_responses.forEach((r, i) => {
        console.log(`  ${i + 1}. ${r.message.substring(0, 80)}...`);
      });
    }
    
    // Check if interview needs reset
    if (interview.completed_at) {
      console.log('\n⚠️  Interview is marked as completed');
      console.log('To reset this interview, run:');
      console.log(`node reset-interview.js ${token}`);
    } else if (interview.started_at && interview.questions_asked && interview.questions_asked.length >= interview.question_count) {
      console.log('\n⚠️  Interview has reached maximum questions but not marked complete');
      console.log('To reset this interview, run:');
      console.log(`node reset-interview.js ${token}`);
    } else {
      console.log('\n✅ Interview is ready to continue');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkInterview();
