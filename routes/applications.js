const express = require('express');
const authMiddleware = require('../middleware/auth');
const router = express.Router();

// Get all applications (authenticated - employer's jobs only)
router.get('/', authMiddleware, async (req, res) => {
  const db = req.app.locals.db;
  
  try {
    const result = await db.query(
      `SELECT a.*, 
              c.first_name, c.last_name, c.email, c.phone, c.resume_url, c.picture_url, c.skills, c.certifications,
              j.title as job_title, j.location as job_location,
              rs.overall_score, rs.recommendation,
              ta.passed as test_passed, ta.score as test_score, 
              ta.max_score as test_max_score, ta.percentage as test_percentage
       FROM applications a
       LEFT JOIN candidates c ON a.candidate_id = c.id
       LEFT JOIN jobs j ON a.job_id = j.id
       LEFT JOIN resume_scores rs ON a.id = rs.application_id
       LEFT JOIN test_attempts ta ON a.id = ta.application_id
       WHERE j.employer_id = $1
       ORDER BY a.application_date DESC`,
      [req.employerId]
    );
    
    res.json(result.rows);
  } catch (error) {
    console.error('Get applications error:', error);
    res.status(500).json({ error: 'Failed to fetch applications' });
  }
});

// Get single application
router.get('/:id', authMiddleware, async (req, res) => {
  const db = req.app.locals.db;
  
  try {
    const result = await db.query(
      `SELECT 
        a.id as application_id,
        a.job_id,
        a.candidate_id,
        a.status,
        a.current_stage,
        a.application_date,
        a.overall_score as application_overall_score,
        a.employer_notes,
        a.rejection_reason,
        c.id as candidate_id,
        c.email,
        c.first_name,
        c.last_name,
        c.phone,
        c.location,
        c.linkedin_url,
        c.portfolio_url,
        c.resume_url,
        c.picture_url,
        c.cover_letter,
        c.skills,
        c.certifications,
        c.experience_years,
        c.education,
        c.work_history,
        j.title as job_title,
        j.description as job_description,
        j.requirements as job_requirements,
        j.skills_required as job_skills_required,
        rs.id as score_id,
        rs.overall_score,
        rs.skills_match_score,
        rs.experience_score,
        rs.education_score,
        rs.keywords_matched,
        rs.keywords_missing,
        rs.ai_summary,
        rs.strengths,
        rs.weaknesses,
        rs.recommendation,
        e.company_name
       FROM applications a
       LEFT JOIN candidates c ON a.candidate_id = c.id
       LEFT JOIN jobs j ON a.job_id = j.id
       LEFT JOIN resume_scores rs ON a.id = rs.application_id
       LEFT JOIN employers e ON j.employer_id = e.id
       WHERE a.id = $1 AND j.employer_id = $2`,
      [req.params.id, req.employerId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Application not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get application error:', error);
    res.status(500).json({ error: 'Failed to fetch application' });
  }
});

// Submit application (public)
router.post('/', async (req, res) => {
  const db = req.app.locals.db;
  
  console.log('📝 Application submission received:', {
    body: req.body,
    hasDb: !!db
  });
  
  const {
    jobId,
    firstName,
    lastName,
    email,
    phone,
    location,
    linkedinUrl,
    portfolioUrl,
    resumeUrl,
    pictureUrl,
    coverLetter,
    skills,
    experienceYears,
    resumeText,
    certifications,
    education,
  } = req.body;
  
  try {
    // Check if job exists and is active
    const jobCheck = await db.query(
      'SELECT id, status FROM jobs WHERE id = $1',
      [jobId]
    );
    
    if (jobCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Job not found' });
    }
    
    if (jobCheck.rows[0].status !== 'active') {
      return res.status(400).json({ error: 'Job is not accepting applications' });
    }
    
    // Check if candidate already exists
    let candidateId;
    const existingCandidate = await db.query(
      'SELECT id FROM candidates WHERE email = $1',
      [email]
    );
    
    if (existingCandidate.rows.length > 0) {
      candidateId = existingCandidate.rows[0].id;
      
      // Update candidate info
      await db.query(
        `UPDATE candidates SET
          first_name = $1, last_name = $2, phone = $3, location = $4,
          linkedin_url = $5, portfolio_url = $6, resume_url = $7,
          picture_url = $8, cover_letter = $9, skills = $10, experience_years = $11,
          education = $12, certifications = $13,
          updated_at = NOW()
         WHERE id = $14`,
        [firstName, lastName, phone, location, linkedinUrl, portfolioUrl,
         resumeUrl, pictureUrl, coverLetter, skills || [], experienceYears,
         JSON.stringify(education || []), certifications || [], candidateId]
      );
    } else {
      // Create new candidate
      const candidateResult = await db.query(
        `INSERT INTO candidates (
          email, first_name, last_name, phone, location,
          linkedin_url, portfolio_url, resume_url, picture_url, cover_letter,
          skills, experience_years, education, certifications, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW(), NOW())
        RETURNING id`,
        [email, firstName, lastName, phone, location, linkedinUrl,
         portfolioUrl, resumeUrl, pictureUrl, coverLetter, skills || [], experienceYears,
         JSON.stringify(education || []), certifications || []]
      );
      
      candidateId = candidateResult.rows[0].id;
    }
    
    // Check if already applied
    const existingApplication = await db.query(
      'SELECT id FROM applications WHERE job_id = $1 AND candidate_id = $2',
      [jobId, candidateId]
    );
    
    if (existingApplication.rows.length > 0) {
      return res.status(409).json({ error: 'Already applied to this job' });
    }
    
    // Create application
    const applicationResult = await db.query(
      `INSERT INTO applications (
        job_id, candidate_id, status, current_stage,
        application_date, created_at, updated_at
      ) VALUES ($1, $2, 'applied', 'application_received', NOW(), NOW(), NOW())
      RETURNING *`,
      [jobId, candidateId]
    );
    
    const application = applicationResult.rows[0];
    
    // Trigger AI resume scoring (async, don't wait)
    const aiService = require('../services/ai-service');
    const emailService = require('../services/email-service');
    
    // Get job details for AI scoring
    const jobDetails = await db.query(
      'SELECT * FROM jobs WHERE id = $1',
      [jobId]
    );
    
    if (jobDetails.rows.length > 0) {
      const job = jobDetails.rows[0];
      
      // Score resume in background
      aiService.analyzeResume(
        {
          skills: skills || [],
          experience_years: experienceYears,
          education: education || [],
          resume_text: resumeText || '',
          certifications: certifications || [],
        },
        {
          title: job.title,
          description: job.description,
          skills_required: job.skills_required || [],
          experience_level: job.experience_level,
        }
      ).then(async (analysis) => {
        // Save resume score
        await db.query(
          `INSERT INTO resume_scores (
            application_id, overall_score, skills_match_score,
            experience_score, education_score, keywords_matched,
            keywords_missing, ai_summary, strengths, weaknesses, recommendation
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          [
            application.id,
            analysis.overall_score,
            analysis.skills_match_score,
            analysis.experience_score,
            analysis.education_score,
            analysis.keywords_matched,
            analysis.keywords_missing,
            analysis.ai_summary,
            analysis.strengths,
            analysis.weaknesses,
            analysis.recommendation,
          ]
        );
        
        // Update application
        await db.query(
          `UPDATE applications
           SET overall_score = $1, status = 'screening', screening_completed_at = NOW()
           WHERE id = $2`,
          [analysis.overall_score, application.id]
        );
      }).catch(err => {
        console.error('AI scoring error:', err);
      });
      
      // Send confirmation email
      // Get employer industry for email template
      const employerResult = await db.query(
        'SELECT industry FROM employers WHERE id = $1',
        [job.employer_id]
      );
      const industry = employerResult.rows[0]?.industry || 'other';
      
      emailService.sendApplicationConfirmation(
        email,
        `${firstName} ${lastName}`,
        job.title,
        'HireFlow',
        industry
      ).catch(err => {
        console.error('Email error:', err);
      });
    }
    
    res.status(201).json({
      success: true,
      application,
      message: 'Application submitted successfully'
    });
  } catch (error) {
    console.error('❌ Submit application error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ 
      error: 'Failed to submit application',
      message: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Update application status (authenticated)
router.patch('/:id/status', authMiddleware, async (req, res) => {
  const db = req.app.locals.db;
  const { status, notes } = req.body;
  
  try {
    // Check if application belongs to employer's job
    const checkResult = await db.query(
      `SELECT a.id FROM applications a
       LEFT JOIN jobs j ON a.job_id = j.id
       WHERE a.id = $1 AND j.employer_id = $2`,
      [req.params.id, req.employerId]
    );
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Application not found' });
    }
    
    // Update application
    const result = await db.query(
      `UPDATE applications
       SET status = $1, employer_notes = COALESCE($2, employer_notes), updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [status, notes, req.params.id]
    );
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update application status error:', error);
    res.status(500).json({ error: 'Failed to update application' });
  }
});

// Approve/reject at approval gate (authenticated)
router.post('/:id/approve', authMiddleware, async (req, res) => {
  const db = req.app.locals.db;
  const { gateName, approved, notes } = req.body;
  const emailService = require('../services/email-service');
  
  try {
    // Check if application belongs to employer's job and get full details
    const appResult = await db.query(
      `SELECT a.*, a.status as current_status,
              c.email as candidate_email, c.first_name, c.last_name,
              j.title as job_title, e.company_name
       FROM applications a
       LEFT JOIN candidates c ON a.candidate_id = c.id
       LEFT JOIN jobs j ON a.job_id = j.id
       LEFT JOIN employers e ON j.employer_id = e.id
       WHERE a.id = $1 AND j.employer_id = $2`,
      [req.params.id, req.employerId]
    );
    
    if (appResult.rows.length === 0) {
      return res.status(404).json({ error: 'Application not found' });
    }
    
    const application = appResult.rows[0];
    const candidateName = `${application.first_name} ${application.last_name}`;
    
    // Determine new status based on gate and approval
    let newStatus = application.current_status;
    let stageField = null;
    let nextSteps = 'further evaluation';
    
    if (gateName === 'shortlist') {
      newStatus = approved ? 'shortlisted' : 'rejected_screening';
      stageField = 'shortlist_approved_at';
      nextSteps = 'assessment test';
    } else if (gateName === 'test_review') {
      newStatus = approved ? 'ai_interview' : 'rejected_test';
      stageField = 'test_approved_at';
      nextSteps = 'AI interview';
    } else if (gateName === 'final_interview') {
      newStatus = approved ? 'final_interview' : 'rejected_ai_interview';
      stageField = 'ai_interview_approved_at';
      nextSteps = 'final interview';
    }
    
    // Update application
    let updateQuery = `
      UPDATE applications
      SET status = $1, updated_at = NOW()
    `;
    
    if (stageField && approved) {
      updateQuery += `, ${stageField} = NOW()`;
    }
    
    updateQuery += ` WHERE id = $2 RETURNING *`;
    
    const result = await db.query(updateQuery, [newStatus, req.params.id]);
    
    // Log approval gate decision
    await db.query(
      `INSERT INTO approval_gates (
        application_id, gate_name, approved, approved_by,
        decision_date, notes, previous_status, new_status, created_at
      ) VALUES ($1, $2, $3, $4, NOW(), $5, $6, $7, NOW())`,
      [req.params.id, gateName, approved, req.employerId, notes,
       application.current_status, newStatus]
    );
    
    // Send email notification (async, don't wait)
    // Get employer industry for email template
    const employerResult = await db.query(
      'SELECT e.industry FROM employers e JOIN jobs j ON e.id = j.employer_id WHERE j.id = $1',
      [application.job_id]
    );
    const industry = employerResult.rows[0]?.industry || 'other';
    
    if (approved) {
      emailService.sendShortlistEmail(
        application.candidate_email,
        candidateName,
        application.job_title,
        application.company_name || 'HireFlow',
        nextSteps,
        industry
      ).catch(err => {
        console.error('❌ Error sending shortlist email:', err);
      });
    } else {
      emailService.sendRejectionEmail(
        application.candidate_email,
        candidateName,
        application.job_title,
        application.company_name || 'HireFlow',
        industry
      ).catch(err => {
        console.error('❌ Error sending rejection email:', err);
      });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Approve application error:', error);
    res.status(500).json({ error: 'Failed to process approval' });
  }
});

// Complete final interview (authenticated)
router.post('/:id/final-interview-complete', authMiddleware, async (req, res) => {
  const db = req.app.locals.db;
  const { interviewerName, notes, rating, recommendation } = req.body;
  
  try {
    // Check if application belongs to employer's job
    const checkResult = await db.query(
      `SELECT a.id FROM applications a
       LEFT JOIN jobs j ON a.job_id = j.id
       WHERE a.id = $1 AND j.employer_id = $2`,
      [req.params.id, req.employerId]
    );
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Application not found' });
    }
    
    // Update application with final interview completion
    await db.query(
      `UPDATE applications
       SET final_interview_completed_at = NOW(),
           final_interview_notes = $1,
           final_interview_rating = $2,
           updated_at = NOW()
       WHERE id = $3`,
      [
        `Interviewer: ${interviewerName}\n\nNotes: ${notes}\n\nRecommendation: ${recommendation}`,
        rating,
        req.params.id
      ]
    );
    
    console.log('✅ Final interview marked as completed');
    
    res.json({ success: true, message: 'Final interview completed' });
  } catch (error) {
    console.error('Complete final interview error:', error);
    res.status(500).json({ error: 'Failed to complete final interview' });
  }
});

// Mark as hired (authenticated)
router.post('/:id/mark-hired', authMiddleware, async (req, res) => {
  const db = req.app.locals.db;
  const emailService = require('../services/email-service');
  
  try {
    // Get application details
    const appResult = await db.query(
      `SELECT a.*, c.first_name, c.last_name, c.email, j.title as job_title, e.company_name
       FROM applications a
       LEFT JOIN candidates c ON a.candidate_id = c.id
       LEFT JOIN jobs j ON a.job_id = j.id
       LEFT JOIN employers e ON j.employer_id = e.id
       WHERE a.id = $1 AND j.employer_id = $2`,
      [req.params.id, req.employerId]
    );
    
    if (appResult.rows.length === 0) {
      return res.status(404).json({ error: 'Application not found' });
    }
    
    const application = appResult.rows[0];
    const candidateName = `${application.first_name} ${application.last_name}`;
    
    // Update application to hired
    await db.query(
      `UPDATE applications
       SET status = 'hired',
           hired_at = NOW(),
           updated_at = NOW()
       WHERE id = $1`,
      [req.params.id]
    );
    
    console.log('✅ Candidate marked as hired');
    
    // Send welcome email
    await emailService.sendEmail(
      application.email,
      `🎉 Welcome to ${application.company_name}!`,
      `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f9f9f9; padding: 20px;">
          <div style="background: linear-gradient(135deg, #FBB03B, #F97316); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: #0F0F0F; margin: 0; font-size: 32px;">🎉 Welcome Aboard!</h1>
          </div>
          
          <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px;">
            <p style="font-size: 16px; color: #333;">Dear ${candidateName},</p>
            
            <p style="font-size: 15px; color: #555; line-height: 1.6;">
              We are absolutely delighted to welcome you to the <strong>${application.company_name}</strong> team as our new <strong>${application.job_title}</strong>!
            </p>
            
            <div style="background: #FFF8EC; border: 2px solid #FBB03B; border-radius: 12px; padding: 20px; margin: 25px 0; text-align: center;">
              <h2 style="margin: 0; color: #C47F00; font-size: 24px;">🎊 You're Officially Hired!</h2>
              <p style="margin: 10px 0 0; color: #666;">We can't wait to see the amazing contributions you'll make to our team.</p>
            </div>
            
            <div style="background: #EFF6FF; border-left: 4px solid #2563EB; padding: 15px; margin: 20px 0;">
              <h4 style="margin: 0 0 10px; color: #1E40AF;">📋 What's Next?</h4>
              <ul style="margin: 0; padding-left: 20px; color: #666;">
                <li style="margin: 5px 0;">Our HR team will contact you with onboarding details</li>
                <li style="margin: 5px 0;">You'll receive information about your start date and first day</li>
                <li style="margin: 5px 0;">We'll send you all necessary paperwork and documentation</li>
                <li style="margin: 5px 0;">Get ready to meet your new team!</li>
              </ul>
            </div>
            
            <p style="font-size: 15px; color: #555; line-height: 1.6;">
              If you have any questions before your start date, please don't hesitate to reach out to us.
            </p>
            
            <p style="font-size: 15px; color: #333; margin-top: 30px;">
              Welcome to the team!<br>
              <strong>${application.company_name} Team</strong>
            </p>
          </div>
          
          <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
            <p>This is an automated message from HireFlow ATS</p>
          </div>
        </div>
      `,
      application.company_name
    );
    
    console.log('✅ Welcome email sent');
    
    res.json({ success: true, message: 'Candidate marked as hired' });
  } catch (error) {
    console.error('Mark as hired error:', error);
    res.status(500).json({ error: 'Failed to mark as hired' });
  }
});

// Schedule final interview
router.post('/:id/schedule-final-interview', authMiddleware, async (req, res) => {
  const db = req.app.locals.db;
  const { interviewDate, interviewTime, interviewType, location, interviewers, additionalNotes } = req.body;
  
  try {
    // Get application details
    const appResult = await db.query(
      `SELECT a.*, c.first_name, c.last_name, c.email, j.title as job_title, e.company_name
       FROM applications a
       JOIN candidates c ON a.candidate_id = c.id
       JOIN jobs j ON a.job_id = j.id
       JOIN employers e ON j.employer_id = e.id
       WHERE a.id = $1 AND j.employer_id = $2`,
      [req.params.id, req.employerId]
    );
    
    if (appResult.rows.length === 0) {
      return res.status(404).json({ error: 'Application not found' });
    }
    
    const application = appResult.rows[0];
    
    // Update application status to final_interview
    await db.query(
      `UPDATE applications 
       SET status = 'final_interview',
           current_stage = 'final_interview',
           final_interview_scheduled_at = NOW()
       WHERE id = $1`,
      [req.params.id]
    );
    
    // Format date and time for email
    const interviewDateTime = new Date(`${interviewDate}T${interviewTime}`);
    const formattedDate = interviewDateTime.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
    const formattedTime = interviewDateTime.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true
    });
    
    // Send email notification
    const emailService = require('../services/email-service');
    await emailService.sendEmail(
      application.email,
      `Final Interview Scheduled - ${application.job_title}`,
      `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 28px;">📅 Final Interview Scheduled!</h1>
          </div>
          
          <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
            <p style="font-size: 16px; color: #333; margin-bottom: 20px;">
              Dear <strong>${application.first_name} ${application.last_name}</strong>,
            </p>
            
            <p style="font-size: 15px; color: #555; line-height: 1.6;">
              Congratulations! We're excited to invite you to the final interview for the 
              <strong>${application.job_title}</strong> position at <strong>${application.company_name}</strong>.
            </p>
            
            <div style="background: white; padding: 25px; border-radius: 10px; margin: 25px 0; border-left: 4px solid #667eea;">
              <h2 style="color: #667eea; margin-top: 0; font-size: 20px;">Interview Details</h2>
              
              <div style="margin: 15px 0;">
                <p style="margin: 8px 0; color: #333;">
                  <strong>📅 Date:</strong> ${formattedDate}
                </p>
                <p style="margin: 8px 0; color: #333;">
                  <strong>🕐 Time:</strong> ${formattedTime}
                </p>
                <p style="margin: 8px 0; color: #333;">
                  <strong>${interviewType === 'video' ? '💻' : '📍'} Type:</strong> 
                  ${interviewType === 'video' ? 'Video Call' : 'In-Person Interview'}
                </p>
                ${location ? `
                  <p style="margin: 8px 0; color: #333;">
                    <strong>${interviewType === 'video' ? '🔗 Platform' : '📍 Location'}:</strong> ${location}
                  </p>
                ` : ''}
                <p style="margin: 8px 0; color: #333;">
                  <strong>👥 Interview Panel:</strong> ${interviewers}
                </p>
              </div>
            </div>
            
            ${additionalNotes ? `
              <div style="background: #fff3cd; padding: 20px; border-radius: 10px; margin: 20px 0; border-left: 4px solid #ffc107;">
                <h3 style="color: #856404; margin-top: 0; font-size: 16px;">📝 Additional Information</h3>
                <p style="color: #856404; margin: 0; white-space: pre-line;">${additionalNotes}</p>
              </div>
            ` : ''}
            
            <div style="background: #d1ecf1; padding: 20px; border-radius: 10px; margin: 20px 0; border-left: 4px solid #17a2b8;">
              <h3 style="color: #0c5460; margin-top: 0; font-size: 16px;">💡 Preparation Tips</h3>
              <ul style="color: #0c5460; margin: 10px 0; padding-left: 20px;">
                <li>Review the job description and requirements</li>
                <li>Prepare questions about the role and company</li>
                <li>Test your ${interviewType === 'video' ? 'internet connection and camera' : 'route to the office'}</li>
                <li>Have your resume and portfolio ready to discuss</li>
                <li>Arrive/Join ${interviewType === 'video' ? '5 minutes early' : '10 minutes early'}</li>
              </ul>
            </div>
            
            <p style="font-size: 15px; color: #555; line-height: 1.6; margin-top: 25px;">
              If you need to reschedule or have any questions, please reply to this email or contact us as soon as possible.
            </p>
            
            <p style="font-size: 15px; color: #333; margin-top: 30px;">
              We look forward to meeting with you!<br>
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
    
    console.log('✅ Final interview scheduled and email sent');
    
    res.json({ 
      success: true, 
      message: 'Final interview scheduled successfully',
      interviewDate: formattedDate,
      interviewTime: formattedTime
    });
  } catch (error) {
    console.error('Schedule final interview error:', error);
    res.status(500).json({ error: 'Failed to schedule final interview' });
  }
});

// Final Scoring Analysis (authenticated)
router.post('/:id/final-scoring', authMiddleware, async (req, res) => {
  const db = req.app.locals.db;
  const { parameters } = req.body;
  const aiService = require('../services/ai-service');

  try {
    // Get application details
    const appResult = await db.query(
      `SELECT 
        a.id, a.status,
        c.first_name, c.last_name, c.email,
        j.title as job_title,
        rs.overall_score as resume_score,
        ta.percentage as test_percentage,
        ta.passed as test_passed
       FROM applications a
       LEFT JOIN candidates c ON a.candidate_id = c.id
       LEFT JOIN jobs j ON a.job_id = j.id
       LEFT JOIN resume_scores rs ON a.id = rs.application_id
       LEFT JOIN test_attempts ta ON a.id = ta.application_id
       WHERE a.id = $1 AND j.employer_id = $2`,
      [req.params.id, req.employerId]
    );

    if (appResult.rows.length === 0) {
      return res.status(404).json({ error: 'Application not found' });
    }

    const application = appResult.rows[0];

    // Get AI interview data if available
    const aiInterviewResult = await db.query(
      `SELECT overall_score, communication_score, technical_score, behavioral_score
       FROM ai_interviews
       WHERE application_id = $1`,
      [req.params.id]
    );

    const aiInterview = aiInterviewResult.rows[0] || null;

    // Calculate overall score from parameters
    const totalAchieved = parameters.reduce((sum, p) => sum + p.achievedScore, 0);
    const totalMax = parameters.reduce((sum, p) => sum + p.maxScore, 0);
    const finalScore = totalMax > 0 ? (totalAchieved / totalMax) * 100 : 0;

    // Prepare data for AI analysis - ensure all scores are numbers
    const resumeScore = Number(application.resume_score) || 0;
    const testScore = Number(application.test_percentage) || 0;
    const aiInterviewScore = Number(aiInterview?.overall_score) || 0;

    const analysisData = {
      candidateName: `${application.first_name} ${application.last_name}`,
      jobTitle: application.job_title,
      resumeScore: resumeScore,
      testScore: testScore,
      testPassed: application.test_passed || false,
      aiInterviewScore: aiInterviewScore,
      finalScoringParameters: parameters,
      finalScore: finalScore,
    };

    // Generate AI decision
    const prompt = `You are an expert HR analyst. Based on the following candidate evaluation data, provide a final hiring decision and recommendation.

Candidate: ${analysisData.candidateName}
Position: ${analysisData.jobTitle}

Evaluation Scores:
- Resume/CV Score: ${resumeScore.toFixed(1)}%
- Technical Test Score: ${testScore.toFixed(1)}% (${analysisData.testPassed ? 'Passed' : 'Failed'})
- AI Interview Score: ${aiInterviewScore.toFixed(1)}%

Final Scoring Parameters:
${parameters.map(p => `- ${p.name}: ${p.achievedScore}/${p.maxScore} (${((p.achievedScore/p.maxScore)*100).toFixed(1)}%)`).join('\n')}

Overall Final Score: ${finalScore.toFixed(1)}%

Provide a comprehensive final decision in 3-4 sentences that:
1. Summarizes the candidate's overall performance across all evaluation stages
2. Highlights key strengths and any concerns
3. Makes a clear recommendation (Strongly Recommend Hire, Recommend Hire, Consider with Reservations, or Do Not Recommend)
4. Provides brief reasoning for the recommendation

Keep the response professional, concise, and actionable.`;

    // Generate AI decision using OpenAI directly
    const OpenAI = require('openai');
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    
    const aiResponse = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are an expert HR analyst providing hiring recommendations.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,
      max_tokens: 500,
    });

    const aiDecision = aiResponse.choices[0].message.content;

    // Determine recommendation based on final score
    let recommendation = 'do_not_hire';
    if (finalScore >= 80) {
      recommendation = 'hire';
    } else if (finalScore >= 65) {
      recommendation = 'consider';
    }

    // Store the final scoring in database
    await db.query(
      `INSERT INTO final_scoring (application_id, parameters, final_score, ai_decision, recommendation, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (application_id) 
       DO UPDATE SET parameters = $2, final_score = $3, ai_decision = $4, recommendation = $5, updated_at = NOW()`,
      [req.params.id, JSON.stringify(parameters), finalScore, aiDecision, recommendation]
    );

    // Update application status to 'final_interview' after scoring
    await db.query(
      `UPDATE applications
       SET status = 'final_interview',
           updated_at = NOW()
       WHERE id = $1`,
      [req.params.id]
    );

    console.log('✅ Final scoring saved and status updated to final_interview');

    res.json({
      success: true,
      finalScore: finalScore,
      decision: aiDecision,
      recommendation: recommendation,
    });
  } catch (error) {
    console.error('Final scoring error:', error);
    res.status(500).json({ error: 'Failed to process final scoring' });
  }
});

// Get Final Scoring Data (authenticated)
router.get('/:id/final-scoring', authMiddleware, async (req, res) => {
  const db = req.app.locals.db;

  try {
    const result = await db.query(
      `SELECT parameters, final_score, ai_decision, recommendation, created_at, updated_at
       FROM final_scoring
       WHERE application_id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.json({ exists: false });
    }

    const scoring = result.rows[0];
    res.json({
      exists: true,
      parameters: scoring.parameters,
      finalScore: Number(scoring.final_score),
      decision: scoring.ai_decision,
      recommendation: scoring.recommendation,
      createdAt: scoring.created_at,
      updatedAt: scoring.updated_at,
    });
  } catch (error) {
    console.error('Get final scoring error:', error);
    res.status(500).json({ error: 'Failed to retrieve final scoring' });
  }
});

module.exports = router;
