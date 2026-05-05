const express = require('express');
const { v4: uuidv4 } = require('uuid');
const authMiddleware = require('../middleware/auth');
const router = express.Router();

// Get all interviews for employer (authenticated)
router.get('/', authMiddleware, async (req, res) => {
  const db = req.app.locals.db;
  
  try {
    const result = await db.query(
      `SELECT ai.*, a.id as application_id, 
              c.first_name, c.last_name, c.email,
              j.title as job_title
       FROM ai_interviews ai
       LEFT JOIN applications a ON ai.application_id = a.id
       LEFT JOIN candidates c ON a.candidate_id = c.id
       LEFT JOIN jobs j ON a.job_id = j.id
       WHERE j.employer_id = $1
       ORDER BY ai.created_at DESC`,
      [req.employerId]
    );
    
    res.json(result.rows);
  } catch (error) {
    console.error('Get interviews error:', error);
    res.status(500).json({ error: 'Failed to fetch interviews' });
  }
});

// Get interview by token (public - for candidates)
router.get('/token/:token', async (req, res) => {
  const db = req.app.locals.db;
  
  try {
    const result = await db.query(
      `SELECT ai.*, a.id as application_id,
              j.title as job_title, j.description as job_description,
              e.company_name
       FROM ai_interviews ai
       LEFT JOIN applications a ON ai.application_id = a.id
       LEFT JOIN jobs j ON a.job_id = j.id
       LEFT JOIN employers e ON j.employer_id = e.id
       WHERE ai.interview_token = $1`,
      [req.params.token]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Interview not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get interview by token error:', error);
    res.status(500).json({ error: 'Failed to fetch interview' });
  }
});

// Create AI interview (authenticated)
router.post('/', authMiddleware, async (req, res) => {
  const db = req.app.locals.db;
  const { applicationId } = req.body;
  
  try {
    // Verify application belongs to employer's job
    const appCheck = await db.query(
      `SELECT a.id FROM applications a
       LEFT JOIN jobs j ON a.job_id = j.id
       WHERE a.id = $1 AND j.employer_id = $2`,
      [applicationId, req.employerId]
    );
    
    if (appCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Application not found' });
    }
    
    // Generate unique token
    const token = uuidv4();
    
    // Create interview
    const result = await db.query(
      `INSERT INTO ai_interviews (
        application_id, interview_token, created_at, updated_at
      ) VALUES ($1, $2, NOW(), NOW())
      RETURNING *`,
      [applicationId, token]
    );
    
    // Update application status
    await db.query(
      `UPDATE applications
       SET status = 'ai_interview', updated_at = NOW()
       WHERE id = $1`,
      [applicationId]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create interview error:', error);
    res.status(500).json({ error: 'Failed to create interview' });
  }
});

// Start interview (public - by token)
router.post('/token/:token/start', async (req, res) => {
  const db = req.app.locals.db;
  
  try {
    const result = await db.query(
      `UPDATE ai_interviews
       SET started_at = NOW(), updated_at = NOW()
       WHERE interview_token = $1
       RETURNING *`,
      [req.params.token]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Interview not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Start interview error:', error);
    res.status(500).json({ error: 'Failed to start interview' });
  }
});

// Submit interview response (public - by token)
router.post('/token/:token/response', async (req, res) => {
  const db = req.app.locals.db;
  const { question, response } = req.body;
  
  try {
    // Get current interview
    const interviewResult = await db.query(
      'SELECT * FROM ai_interviews WHERE interview_token = $1',
      [req.params.token]
    );
    
    if (interviewResult.rows.length === 0) {
      return res.status(404).json({ error: 'Interview not found' });
    }
    
    const interview = interviewResult.rows[0];
    const questions = interview.questions_asked || [];
    const responses = interview.candidate_responses || [];
    
    // Add new question and response
    questions.push(question);
    responses.push(response);
    
    // Update interview
    const result = await db.query(
      `UPDATE ai_interviews
       SET questions_asked = $1, candidate_responses = $2, updated_at = NOW()
       WHERE interview_token = $3
       RETURNING *`,
      [questions, responses, req.params.token]
    );
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Submit interview response error:', error);
    res.status(500).json({ error: 'Failed to submit response' });
  }
});

// Generate AI interview question (public - by token)
router.post('/token/:token/generate-question', async (req, res) => {
  const db = req.app.locals.db;
  const aiService = require('../services/ai-service');
  
  try {
    // Get interview
    const interviewResult = await db.query(
      `SELECT ai.*, j.title, j.description, j.skills_required, j.experience_level
       FROM ai_interviews ai
       LEFT JOIN applications a ON ai.application_id = a.id
       LEFT JOIN jobs j ON a.job_id = j.id
       WHERE ai.interview_token = $1`,
      [req.params.token]
    );
    
    if (interviewResult.rows.length === 0) {
      return res.status(404).json({ error: 'Interview not found' });
    }
    
    const interview = interviewResult.rows[0];
    const questions = interview.questions_asked || [];
    const responses = interview.candidate_responses || [];
    
    // Build transcript
    const transcript = [];
    for (let i = 0; i < questions.length; i++) {
      transcript.push({ role: 'ai', message: questions[i], timestamp: new Date().toISOString() });
      if (responses[i]) {
        transcript.push({ role: 'candidate', message: responses[i], timestamp: new Date().toISOString() });
      }
    }
    
    // Generate next question
    const result = await aiService.generateInterviewQuestion(
      interview.description,
      {
        title: interview.title,
        skills_required: interview.skills_required || [],
        experience_level: interview.experience_level,
      },
      transcript,
      questions.length + 1
    );
    
    res.json(result);
  } catch (error) {
    console.error('Generate question error:', error);
    res.status(500).json({ error: 'Failed to generate question' });
  }
});

// Evaluate interview (public - by token)
router.post('/token/:token/evaluate', async (req, res) => {
  const db = req.app.locals.db;
  const aiService = require('../services/ai-service');
  
  try {
    // Get interview
    const interviewResult = await db.query(
      `SELECT ai.*, j.title, j.description, j.skills_required, j.experience_level
       FROM ai_interviews ai
       LEFT JOIN applications a ON ai.application_id = a.id
       LEFT JOIN jobs j ON a.job_id = j.id
       WHERE ai.interview_token = $1`,
      [req.params.token]
    );
    
    if (interviewResult.rows.length === 0) {
      return res.status(404).json({ error: 'Interview not found' });
    }
    
    const interview = interviewResult.rows[0];
    const questions = interview.questions_asked || [];
    const responses = interview.candidate_responses || [];
    
    // Build transcript
    const transcript = [];
    for (let i = 0; i < questions.length; i++) {
      transcript.push({ role: 'ai', message: questions[i], timestamp: new Date().toISOString() });
      if (responses[i]) {
        transcript.push({ role: 'candidate', message: responses[i], timestamp: new Date().toISOString() });
      }
    }
    
    // Evaluate interview
    const evaluation = await aiService.evaluateInterview(
      interview.description,
      {
        title: interview.title,
        skills_required: interview.skills_required || [],
        experience_level: interview.experience_level,
      },
      transcript
    );
    
    res.json(evaluation);
  } catch (error) {
    console.error('Evaluate interview error:', error);
    res.status(500).json({ error: 'Failed to evaluate interview' });
  }
});

// Complete interview (public - by token)
router.post('/token/:token/complete', async (req, res) => {
  const db = req.app.locals.db;
  const {
    communicationScore,
    technicalScore,
    behavioralScore,
    overallScore,
    aiSummary,
    recommendation,
    transcript,
  } = req.body;
  
  try {
    // Update interview
    const result = await db.query(
      `UPDATE ai_interviews
       SET completed_at = NOW(),
           communication_score = $1,
           technical_score = $2,
           behavioral_score = $3,
           overall_score = $4,
           ai_summary = $5,
           recommendation = $6,
           transcript = $7,
           updated_at = NOW()
       WHERE interview_token = $8
       RETURNING *`,
      [communicationScore, technicalScore, behavioralScore, overallScore,
       aiSummary, recommendation, transcript, req.params.token]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Interview not found' });
    }
    
    const interview = result.rows[0];
    
    // Update application status
    await db.query(
      `UPDATE applications
       SET status = 'ai_interview_completed',
           ai_interview_completed_at = NOW(),
           updated_at = NOW()
       WHERE id = $1`,
      [interview.application_id]
    );
    
    res.json(interview);
  } catch (error) {
    console.error('Complete interview error:', error);
    res.status(500).json({ error: 'Failed to complete interview' });
  }
});

// Schedule final interview (authenticated)
router.post('/:applicationId/final', authMiddleware, async (req, res) => {
  const db = req.app.locals.db;
  const { scheduledAt, interviewerName } = req.body;
  
  try {
    // Verify application belongs to employer's job
    const appCheck = await db.query(
      `SELECT a.id FROM applications a
       LEFT JOIN jobs j ON a.job_id = j.id
       WHERE a.id = $1 AND j.employer_id = $2`,
      [req.params.applicationId, req.employerId]
    );
    
    if (appCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Application not found' });
    }
    
    // Create final interview
    const result = await db.query(
      `INSERT INTO final_interviews (
        application_id, scheduled_at, interviewer_name, created_at, updated_at
      ) VALUES ($1, $2, $3, NOW(), NOW())
      RETURNING *`,
      [req.params.applicationId, scheduledAt, interviewerName]
    );
    
    // Update application
    await db.query(
      `UPDATE applications
       SET status = 'final_interview',
           final_interview_scheduled_at = $1,
           updated_at = NOW()
       WHERE id = $2`,
      [scheduledAt, req.params.applicationId]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Schedule final interview error:', error);
    res.status(500).json({ error: 'Failed to schedule interview' });
  }
});

// Invite directly to interview (skip tests and AI interview) (authenticated)
router.post('/:applicationId/invite-directly', authMiddleware, async (req, res) => {
  const db = req.app.locals.db;
  const emailService = require('../services/email-service');
  
  try {
    // Verify application belongs to employer's job
    const appResult = await db.query(
      `SELECT a.*, c.first_name, c.last_name, c.email,
              j.title as job_title, e.company_name
       FROM applications a
       LEFT JOIN candidates c ON a.candidate_id = c.id
       LEFT JOIN jobs j ON a.job_id = j.id
       LEFT JOIN employers e ON j.employer_id = e.id
       WHERE a.id = $1 AND j.employer_id = $2`,
      [req.params.applicationId, req.employerId]
    );
    
    if (appResult.rows.length === 0) {
      return res.status(404).json({ error: 'Application not found' });
    }
    
    const application = appResult.rows[0];
    
    // Update application status to final_interview
    await db.query(
      `UPDATE applications
       SET status = 'final_interview',
           updated_at = NOW()
       WHERE id = $1`,
      [req.params.applicationId]
    );
    
    // Send email invitation
    try {
      await emailService.sendEmail(
        application.email,
        `🎯 Interview Invitation - ${application.job_title} at ${application.company_name}`,
        `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #FBB03B;">Congratulations! You're Invited to Interview</h2>
            <p>Dear ${application.first_name} ${application.last_name},</p>
            <p>We're impressed with your application for the <strong>${application.job_title}</strong> position at <strong>${application.company_name}</strong>.</p>
            <p>We would like to invite you to the next stage of our hiring process - a direct interview with our team.</p>
            <p>Our team will reach out to you shortly to schedule a convenient time for the interview.</p>
            <p>If you have any questions, please don't hesitate to contact us.</p>
            <p>Best regards,<br>${application.company_name} Hiring Team</p>
          </div>
        `,
        application.company_name
      );
    } catch (emailError) {
      console.error('Failed to send interview invitation email:', emailError);
      // Don't fail the request if email fails
    }
    
    res.json({
      success: true,
      message: 'Interview invitation sent successfully',
      application: {
        id: application.id,
        status: 'final_interview',
        candidate_name: `${application.first_name} ${application.last_name}`,
        email: application.email,
      },
    });
  } catch (error) {
    console.error('Invite directly error:', error);
    res.status(500).json({ error: 'Failed to send interview invitation' });
  }
});

module.exports = router;
