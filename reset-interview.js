const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

async function resetInterview() {
  const token = process.argv[2];
  
  if (!token) {
    console.log('Usage: node reset-interview.js <interview_token>');
    process.exit(1);
  }
  
  try {
    console.log('🔄 Resetting interview:', token);
    
    // Reset the interview to initial state
    const result = await pool.query(
      `UPDATE ai_interviews
       SET started_at = NULL,
           completed_at = NULL,
           questions_asked = '[]'::jsonb,
           candidate_responses = '[]'::jsonb,
           technical_score = NULL,
           communication_score = NULL,
           problem_solving_score = NULL,
           overall_score = NULL,
           ai_summary = NULL,
           recommendation = NULL,
           updated_at = NOW()
       WHERE interview_token = $1
       RETURNING interview_token, question_count`,
      [token]
    );
    
    if (result.rows.length === 0) {
      console.log('❌ Interview not found');
      process.exit(1);
    }
    
    console.log('✅ Interview reset successfully!');
    console.log('Token:', result.rows[0].interview_token);
    console.log('Question Count:', result.rows[0].question_count);
    console.log('\nThe interview is now ready to be taken again.');
    console.log('Interview URL: http://localhost:5173/interview/' + token);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

resetInterview();
