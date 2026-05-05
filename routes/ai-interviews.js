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
    const maxQuestions = interview.question_count || 5; // Get from database or default to 5
    
    console.log(`📊 Interview progress: ${questionsAsked.length}/${maxQuestions} questions asked`);
    
    // Check if we've reached the maximum number of questions
    if (questionsAsked.length >= maxQuestions) {
      console.log('🏁 Maximum questions reached, ending interview');
      return res.json({
        should_end: true,
        reason: `Interview complete - all ${maxQuestions} questions have been asked`
      });
    }
    
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
    
    console.log(`🤖 Generating question ${questionNumber}/${maxQuestions} with ${fullTranscript.length} previous messages in context`);
    
    // Generate question using AI with FULL conversation history
    const questionData = await aiService.generateInterviewQuestion(
      interview.job_description,
      {
        title: interview.job_title,
        skills_required: interview.skills_required,
        requirements: interview.job_requirements
      },
      fullTranscript,
      questionNumber,
      maxQuestions // Pass max questions to AI
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
    
    // Validation: Ensure interview has meaningful responses
    if (candidateResponses.length === 0) {
      console.log('⚠️  Cannot complete interview - no candidate responses');
      return res.status(400).json({ 
        error: 'Cannot complete interview without any responses',
        message: 'Please answer at least one question before completing the interview'
      });
    }
    
    if (candidateResponses.length < Math.min(3, interview.question_count)) {
      console.log(`⚠️  Warning: Only ${candidateResponses.length} responses out of ${interview.question_count} questions`);
    }
    
    // Combine into full transcript
    const fullTranscript = [];
    for (let i = 0; i < Math.max(questionsAsked.length, candidateResponses.length); i++) {
      if (questionsAsked[i]) fullTranscript.push(questionsAsked[i]);
      if (candidateResponses[i]) fullTranscript.push(candidateResponses[i]);
    }
    
    console.log(`📊 Completing interview: ${questionsAsked.length} questions, ${candidateResponses.length} responses`);
    
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
    
    console.log('✅ Interview completed successfully');
    
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
  const { applicationId, validFrom, validUntil, questionCount } = req.body;
  const emailService = require('../services/email-service');
  
  try {
    console.log('🎤 AI Interview invitation request received for application:', applicationId);
    console.log('📅 Valid from:', validFrom, 'Valid until:', validUntil);
    console.log('🎯 Question count:', questionCount || 'default (5-8)');
    
    // Get application details
    const appResult = await db.query(
      `SELECT a.*, c.first_name, c.last_name, c.email, j.title as job_title, j.id as job_id, e.company_name
       FROM applications a
       LEFT JOIN candidates c ON a.candidate_id = c.id
       LEFT JOIN jobs j ON a.job_id = j.id
       LEFT JOIN employers e ON j.employer_id = e.id
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
      
      // Update validity dates if provided
      if (validFrom && validUntil) {
        await db.query(
          `UPDATE ai_interviews 
           SET valid_from = $1, valid_until = $2, question_count = $3, updated_at = NOW()
           WHERE interview_token = $4`,
          [validFrom, validUntil, questionCount || 5, interviewToken]
        );
        console.log('✅ Updated interview validity dates and question count');
      } else if (questionCount) {
        await db.query(
          `UPDATE ai_interviews 
           SET question_count = $1, updated_at = NOW()
           WHERE interview_token = $2`,
          [questionCount, interviewToken]
        );
        console.log('✅ Updated interview question count');
      }
    } else {
      // Create AI interview record
      interviewToken = uuidv4();
      console.log('🆕 Creating new interview token:', interviewToken);
      
      await db.query(
        `INSERT INTO ai_interviews (
          application_id, interview_token, valid_from, valid_until, question_count, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
        [applicationId, interviewToken, validFrom || null, validUntil || null, questionCount || 5]
      );
      console.log('✅ AI interview record created with', questionCount || 5, 'questions');
    }
    
    // Generate interview link
    const interviewLink = `${process.env.APP_URL}/interview/${interviewToken}`;
    console.log('🔗 Interview link generated:', interviewLink);
    
    // Format dates for email
    const formatDate = (dateStr) => {
      if (!dateStr) return null;
      const date = new Date(dateStr);
      return date.toLocaleString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZoneName: 'short'
      });
    };
    
    const validFromFormatted = formatDate(validFrom);
    const validUntilFormatted = formatDate(validUntil);
    
    // Send email with custom template including dates
    console.log('📧 Sending AI interview invitation email to:', application.email);
    
    await emailService.sendEmail(
      application.email,
      `🎤 AI Interview Invitation - ${application.job_title} at ${application.company_name}`,
      `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f9f9f9; padding: 20px;">
          <div style="background: #FBB03B; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: #0F0F0F; margin: 0; font-size: 28px;">AI Interview Invitation</h1>
          </div>
          
          <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px;">
            <p style="font-size: 16px; color: #333;">Dear ${application.first_name} ${application.last_name},</p>
            
            <p style="font-size: 15px; color: #555; line-height: 1.6;">
              Congratulations! We're impressed with your application for the <strong>${application.job_title}</strong> position at <strong>${application.company_name}</strong>.
            </p>
            
            <p style="font-size: 15px; color: #555; line-height: 1.6;">
              We would like to invite you to complete an AI-powered video interview as the next step in our hiring process.
            </p>
            
            ${validFromFormatted && validUntilFormatted ? `
            <div style="background: #FFF8EC; border-left: 4px solid #FBB03B; padding: 15px; margin: 20px 0;">
              <p style="margin: 0 0 10px; font-weight: 600; color: #C47F00;">📅 Interview Validity Period:</p>
              <p style="margin: 5px 0; color: #666;"><strong>Available from:</strong> ${validFromFormatted}</p>
              <p style="margin: 5px 0; color: #666;"><strong>Valid until:</strong> ${validUntilFormatted}</p>
              <p style="margin: 10px 0 0; font-size: 13px; color: #888;">
                ⚠️ Please complete the interview within this time window. The link will expire after the end date.
              </p>
            </div>
            ` : ''}
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${interviewLink}" style="display: inline-block; background: #FBB03B; color: #0F0F0F; padding: 15px 40px; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 16px;">
                Start AI Interview
              </a>
            </div>
            
            <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 0 0 10px; font-weight: 600; color: #333;">What to expect:</p>
              <ul style="margin: 0; padding-left: 20px; color: #666;">
                <li style="margin: 5px 0;">The interview will take approximately 15-20 minutes</li>
                <li style="margin: 5px 0;">You'll be asked 5-7 questions related to the position</li>
                <li style="margin: 5px 0;">Make sure you're in a quiet environment with good lighting</li>
                <li style="margin: 5px 0;">Allow camera and microphone access when prompted</li>
              </ul>
            </div>
            
            <p style="font-size: 14px; color: #666; line-height: 1.6;">
              If you have any questions or technical issues, please don't hesitate to contact us.
            </p>
            
            <p style="font-size: 15px; color: #333; margin-top: 30px;">
              Best regards,<br>
              <strong>${application.company_name} Hiring Team</strong>
            </p>
          </div>
          
          <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
            <p>This is an automated message from HireFlow ATS</p>
          </div>
        </div>
      `,
      application.company_name
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
              a.id as application_id, a.status as application_status,
              a.ai_interview_approved_at,
              c.first_name, c.last_name, c.email,
              j.title as job_title, j.id as job_id
       FROM ai_interviews ai
       LEFT JOIN applications a ON ai.application_id = a.id
       LEFT JOIN candidates c ON a.candidate_id = c.id
       LEFT JOIN jobs j ON a.job_id = j.id
       WHERE j.employer_id = $1
       ORDER BY ai.created_at DESC`,
      [req.employerId]
    );
    
    // Format interviews to match expected structure
    const interviews = result.rows.map(row => ({
      id: row.id,
      application_id: row.application_id,
      interview_type: 'ai_first',
      interview_mode: 'text', // AI interviews are text-based
      scheduled_at: row.created_at,
      started_at: row.started_at,
      completed_at: row.completed_at,
      overall_score: row.overall_score,
      recommendation: row.recommendation,
      candidate: {
        first_name: row.first_name,
        last_name: row.last_name,
        email: row.email,
      },
      job: {
        title: row.job_title,
      },
    }));
    
    res.json({ interviews });
  } catch (error) {
    console.error('Get AI interviews error:', error);
    res.status(500).json({ error: 'Failed to fetch interviews' });
  }
});

// Approve AI interview (authenticated - HR)
router.post('/:applicationId/approve', authMiddleware, async (req, res) => {
  const db = req.app.locals.db;
  const { applicationId } = req.params;
  const { approved, notes } = req.body;
  const emailService = require('../services/email-service');
  
  try {
    console.log('🎯 AI Interview approval request:', { applicationId, approved, notes });
    
    // Get application details
    const appResult = await db.query(
      `SELECT a.*, c.first_name, c.last_name, c.email, j.title as job_title, e.company_name, e.industry
       FROM applications a
       LEFT JOIN candidates c ON a.candidate_id = c.id
       LEFT JOIN jobs j ON a.job_id = j.id
       LEFT JOIN employers e ON j.employer_id = e.id
       WHERE a.id = $1 AND j.employer_id = $2`,
      [applicationId, req.employerId]
    );
    
    if (appResult.rows.length === 0) {
      return res.status(404).json({ error: 'Application not found' });
    }
    
    const application = appResult.rows[0];
    const candidateName = `${application.first_name} ${application.last_name}`;
    
    if (approved) {
      // Approve for final interview
      await db.query(
        `UPDATE applications
         SET status = 'final_interview',
             ai_interview_approved_at = NOW(),
             updated_at = NOW()
         WHERE id = $1`,
        [applicationId]
      );
      
      console.log('✅ AI interview approved, status updated to final_interview');
      
      // Send approval email
      await emailService.sendEmail(
        application.email,
        `🎉 Congratulations - Final Interview Invitation for ${application.job_title}`,
        `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f9f9f9; padding: 20px;">
            <div style="background: #16A34A; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
              <h1 style="color: white; margin: 0; font-size: 28px;">🎉 Great News!</h1>
            </div>
            
            <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px;">
              <p style="font-size: 16px; color: #333;">Dear ${candidateName},</p>
              
              <p style="font-size: 15px; color: #555; line-height: 1.6;">
                Congratulations! We're impressed with your AI interview performance for the <strong>${application.job_title}</strong> position at <strong>${application.company_name}</strong>.
              </p>
              
              <div style="background: #ECFDF5; border-left: 4px solid #16A34A; padding: 15px; margin: 20px 0;">
                <p style="margin: 0; font-weight: 600; color: #15803D;">✅ Your AI interview has been approved!</p>
                <p style="margin: 10px 0 0; color: #666;">
                  We would like to invite you to a final interview with our hiring team.
                </p>
              </div>
              
              <p style="font-size: 15px; color: #555; line-height: 1.6;">
                Our team will reach out to you shortly to schedule the final interview at a time that works best for you.
              </p>
              
              <p style="font-size: 14px; color: #666; line-height: 1.6;">
                If you have any questions, please don't hesitate to contact us.
              </p>
              
              <p style="font-size: 15px; color: #333; margin-top: 30px;">
                Best regards,<br>
                <strong>${application.company_name} Hiring Team</strong>
              </p>
            </div>
            
            <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
              <p>This is an automated message from HireFlow ATS</p>
            </div>
          </div>
        `,
        application.company_name
      );
      
      console.log('✅ Approval email sent');
      
    } else {
      // Reject
      await db.query(
        `UPDATE applications
         SET status = 'rejected_ai_interview',
             rejection_reason = $1,
             updated_at = NOW()
         WHERE id = $2`,
        [notes || 'Did not meet AI interview requirements', applicationId]
      );
      
      console.log('❌ AI interview rejected');
      
      // Send rejection email
      await emailService.sendRejectionEmail(
        application.email,
        candidateName,
        application.job_title,
        application.company_name,
        application.industry || 'other'
      );
      
      console.log('✅ Rejection email sent');
    }
    
    res.json({ success: true, approved });
  } catch (error) {
    console.error('❌ AI interview approval error:', error);
    res.status(500).json({ error: 'Failed to process approval' });
  }
});

module.exports = router;
