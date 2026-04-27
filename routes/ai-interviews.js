const express = require('express');
const authMiddleware = require('../middleware/auth');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');

// Get AI interview by token (public - for candidate)
router.get('/token/:token', async (req, res) => {
  const db = req.app.locals.db;
  
  try {
    const result = await db.query(
      `SELECT ai.*, 
              a.id as application_id,
              c.first_name, c.last_name, c.email, c.resume_url, c.skills, c.experience_years, c.resume_parsed_data,
              j.title as job_title, j.description as job_description, j.requirements as job_requirements, j.skills_required
       FROM ai_interviews ai
       LEFT JOIN applications a ON ai.application_id = a.id
       LEFT JOIN candidates c ON a.candidate_id = c.id
       LEFT JOIN jobs j ON a.job_id = j.id
       WHERE ai.interview_token = $1`,
      [req.params.token]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Interview not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get AI interview error:', error);
    res.status(500).json({ error: 'Failed to fetch interview' });
  }
});

// Get AI interview by application ID (authenticated - for HR)
router.get('/application/:applicationId', authMiddleware, async (req, res) => {
  const db = req.app.locals.db;
  
  try {
    const result = await db.query(
      `SELECT ai.*, 
              a.id as application_id,
              c.first_name, c.last_name, c.email,
              j.title as job_title
       FROM ai_interviews ai
       LEFT JOIN applications a ON ai.application_id = a.id
       LEFT JOIN candidates c ON a.candidate_id = c.id
       LEFT JOIN jobs j ON a.job_id = j.id
       WHERE ai.application_id = $1 AND j.employer_id = $2`,
      [req.params.applicationId, req.employerId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Interview not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get AI interview by application error:', error);
    res.status(500).json({ error: 'Failed to fetch interview' });
  }
});

// Start AI interview (public - candidate clicks link)
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
    console.error('Start AI interview error:', error);
    res.status(500).json({ error: 'Failed to start interview' });
  }
});

// Upload interview video (public - during/after interview)
router.post('/token/:token/upload-video', async (req, res) => {
  const db = req.app.locals.db;
  const multer = require('multer');
  const path = require('path');
  
  // Configure multer for video upload
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, 'uploads/interview-videos/');
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, 'interview-' + uniqueSuffix + path.extname(file.originalname));
    }
  });
  
  const upload = multer({
    storage: storage,
    limits: { fileSize: 500 * 1024 * 1024 }, // 500MB limit
    fileFilter: (req, file, cb) => {
      const allowedTypes = ['video/webm', 'video/mp4', 'video/ogg'];
      if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error('Invalid video format'));
      }
    }
  }).single('video');
  
  upload(req, res, async (err) => {
    if (err) {
      console.error('Video upload error:', err);
      return res.status(400).json({ error: err.message });
    }
    
    if (!req.file) {
      return res.status(400).json({ error: 'No video file provided' });
    }
    
    try {
      const videoUrl = `/uploads/interview-videos/${req.file.filename}`;
      
      // Update interview with video URL
      await db.query(
        `UPDATE ai_interviews
         SET video_url = $1, updated_at = NOW()
         WHERE interview_token = $2`,
        [videoUrl, req.params.token]
      );
      
      console.log('✅ Interview video uploaded:', videoUrl);
      res.json({ success: true, video_url: videoUrl });
    } catch (error) {
      console.error('Error saving video URL:', error);
      res.status(500).json({ error: 'Failed to save video' });
    }
  });
});

// Generate next question (public - during interview)
router.post('/token/:token/question', async (req, res) => {
  const db = req.app.locals.db;
  const aiService = require('../services/ai-service');
  
  try {
    // Get interview data
    const interviewResult = await db.query(
      `SELECT ai.*, 
              a.id as application_id,
              c.resume_parsed_data, c.skills, c.experience_years,
              j.title as job_title, j.description as job_description, 
              j.requirements as job_requirements, j.skills_required
       FROM ai_interviews ai
       LEFT JOIN applications a ON ai.application_id = a.id
       LEFT JOIN candidates c ON a.candidate_id = c.id
       LEFT JOIN jobs j ON a.job_id = j.id
       WHERE ai.interview_token = $1`,
      [req.params.token]
    );
    
    if (interviewResult.rows.length === 0) {
      return res.status(404).json({ error: 'Interview not found' });
    }
    
    const interview = interviewResult.rows[0];
    const questionsAsked = interview.questions_asked || [];
    const candidateResponses = interview.candidate_responses || [];
    
    // Build complete conversation history by interleaving questions and responses
    const fullTranscript = [];
    for (let i = 0; i < Math.max(questionsAsked.length, candidateResponses.length); i++) {
      if (questionsAsked[i]) {
        fullTranscript.push(questionsAsked[i]);
      }
      if (candidateResponses[i]) {
        fullTranscript.push(candidateResponses[i]);
      }
    }
    
    const questionNumber = questionsAsked.length + 1;
    
    console.log(`🤖 Generating question ${questionNumber} with ${fullTranscript.length} previous messages in context`);
    
    // Generate question using AI with FULL conversation history
    const questionData = await aiService.generateInterviewQuestion(
      interview.job_description,
      {
        title: interview.job_title,
        skills_required: interview.skills_required,
        requirements: interview.job_requirements
      },
      fullTranscript,
      questionNumber
    );
    
    // Check if interview should end
    if (questionData.should_end_interview) {
      console.log('🏁 Interview should end:', questionData.end_reason);
      return res.json({
        should_end: true,
        reason: questionData.end_reason
      });
    }
    
    const question = questionData.question;
    console.log(`✅ Generated question ${questionNumber}:`, question.substring(0, 100) + '...');
    
    // Update questions_asked array
    const updatedQuestionsAsked = [
      ...questionsAsked,
      {
        role: 'ai',
        message: question,
        timestamp: new Date().toISOString(),
        question_number: questionNumber
      }
    ];
    
    await db.query(
      `UPDATE ai_interviews
       SET questions_asked = $1, updated_at = NOW()
       WHERE interview_token = $2`,
      [JSON.stringify(updatedQuestionsAsked), req.params.token]
    );
    
    res.json({ question, question_number: questionNumber });
  } catch (error) {
    console.error('❌ Generate question error:', error);
    res.status(500).json({ error: 'Failed to generate question' });
  }
});

// Submit answer (public - candidate responds)
router.post('/token/:token/answer', async (req, res) => {
  const db = req.app.locals.db;
  const { answer, question_number } = req.body;
  
  try {
    // Get current transcript
    const result = await db.query(
      'SELECT questions_asked, candidate_responses FROM ai_interviews WHERE interview_token = $1',
      [req.params.token]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Interview not found' });
    }
    
    const questionsAsked = result.rows[0].questions_asked || [];
    const candidateResponses = result.rows[0].candidate_responses || [];
    
    // Add candidate response
    const updatedResponses = [
      ...candidateResponses,
      {
        role: 'candidate',
        message: answer,
        timestamp: new Date().toISOString(),
        question_number
      }
    ];
    
    await db.query(
      `UPDATE ai_interviews
       SET candidate_responses = $1, updated_at = NOW()
       WHERE interview_token = $2`,
      [JSON.stringify(updatedResponses), req.params.token]
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Submit answer error:', error);
    res.status(500).json({ error: 'Failed to submit answer' });
  }
});

// Complete interview and evaluate (public - when interview ends)
router.post('/token/:token/complete', async (req, res) => {
  const db = req.app.locals.db;
  const aiService = require('../services/ai-service');
  
  try {
    // Get interview data
    const interviewResult = await db.query(
      `SELECT ai.*, 
              a.id as application_id,
              j.title as job_title, j.description as job_description, 
              j.requirements as job_requirements
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
    const questionsAsked = interview.questions_asked || [];
    const candidateResponses = interview.candidate_responses || [];
    
    // Combine into full transcript
    const fullTranscript = [];
    for (let i = 0; i < Math.max(questionsAsked.length, candidateResponses.length); i++) {
      if (questionsAsked[i]) fullTranscript.push(questionsAsked[i]);
      if (candidateResponses[i]) fullTranscript.push(candidateResponses[i]);
    }
    
    // Evaluate interview using AI
    const evaluation = await aiService.evaluateInterview(
      interview.job_description,
      interview.job_requirements,
      fullTranscript
    );
    
    // Update interview with evaluation
    await db.query(
      `UPDATE ai_interviews
       SET completed_at = NOW(),
           technical_score = $1,
           communication_score = $2,
           problem_solving_score = $3,
           overall_score = $4,
           ai_summary = $5,
           recommendation = $6,
           updated_at = NOW()
       WHERE interview_token = $7`,
      [
        evaluation.technical_score,
        evaluation.communication_score,
        evaluation.problem_solving_score || evaluation.technical_score,
        evaluation.overall_score,
        evaluation.feedback,
        evaluation.recommendation,
        req.params.token
      ]
    );
    
    // Update application status
    await db.query(
      `UPDATE applications
       SET status = 'ai_interview_completed', 
           ai_interview_completed_at = NOW(),
           updated_at = NOW()
       WHERE id = $1`,
      [interview.application_id]
    );
    
    res.json({
      success: true,
      evaluation
    });
  } catch (error) {
    console.error('Complete interview error:', error);
    res.status(500).json({ error: 'Failed to complete interview' });
  }
});

// Send AI interview invitation (authenticated - HR)
router.post('/send-invitation', authMiddleware, async (req, res) => {
  const db = req.app.locals.db;
  const { applicationId } = req.body;
  const emailService = require('../services/email-service');
  
  try {
    console.log('🎤 AI Interview invitation request received for application:', applicationId);
    
    // Get application details
    const appResult = await db.query(
      `SELECT a.*, c.first_name, c.last_name, c.email, j.title as job_title, j.id as job_id
       FROM applications a
       LEFT JOIN candidates c ON a.candidate_id = c.id
       LEFT JOIN jobs j ON a.job_id = j.id
       WHERE a.id = $1 AND j.employer_id = $2`,
      [applicationId, req.employerId]
    );
    
    if (appResult.rows.length === 0) {
      console.log('❌ Application not found:', applicationId);
      return res.status(404).json({ error: 'Application not found' });
    }
    
    const application = appResult.rows[0];
    console.log('✅ Application found:', {
      candidate: `${application.first_name} ${application.last_name}`,
      email: application.email,
      job: application.job_title
    });
    
    // Check if AI interview already exists
    const existingInterview = await db.query(
      'SELECT id, interview_token FROM ai_interviews WHERE application_id = $1',
      [applicationId]
    );
    
    let interviewToken;
    
    if (existingInterview.rows.length > 0) {
      interviewToken = existingInterview.rows[0].interview_token;
      console.log('♻️  Reusing existing interview token:', interviewToken);
    } else {
      // Create AI interview record
      interviewToken = uuidv4();
      console.log('🆕 Creating new interview token:', interviewToken);
      
      await db.query(
        `INSERT INTO ai_interviews (
          application_id, interview_token, created_at, updated_at
        ) VALUES ($1, $2, NOW(), NOW())`,
        [applicationId, interviewToken]
      );
      console.log('✅ AI interview record created');
    }
    
    // Generate interview link
    const interviewLink = `${process.env.APP_URL}/interview/${interviewToken}`;
    console.log('🔗 Interview link generated:', interviewLink);
    
    // Send email
    console.log('📧 Sending AI interview invitation email to:', application.email);
    await emailService.sendAIInterviewInvitation(
      application.email,
      `${application.first_name} ${application.last_name}`,
      application.job_title,
      interviewLink
    );
    console.log('✅ AI interview invitation email sent successfully!');
    
    // Update application status
    await db.query(
      `UPDATE applications 
       SET status = 'ai_interview', updated_at = NOW()
       WHERE id = $1`,
      [applicationId]
    );
    console.log('✅ Application status updated to "ai_interview"');
    
    res.json({
      success: true,
      message: 'AI interview invitation sent successfully',
      interviewLink
    });
  } catch (error) {
    console.error('❌ Send AI interview invitation error:', error);
    res.status(500).json({ error: error.message || 'Failed to send invitation' });
  }
});

// Get all AI interviews for employer (authenticated)
router.get('/', authMiddleware, async (req, res) => {
  const db = req.app.locals.db;
  
  try {
    const result = await db.query(
      `SELECT ai.*, 
              a.id as application_id,
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
    console.error('Get AI interviews error:', error);
    res.status(500).json({ error: 'Failed to fetch interviews' });
  }
});

module.exports = router;
