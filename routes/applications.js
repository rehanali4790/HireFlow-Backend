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
      emailService.sendApplicationConfirmation(
        email,
        `${firstName} ${lastName}`,
        job.title,
        'HireFlow'
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
  
  try {
    // Check if application belongs to employer's job
    const appResult = await db.query(
      `SELECT a.*, a.status as current_status FROM applications a
       LEFT JOIN jobs j ON a.job_id = j.id
       WHERE a.id = $1 AND j.employer_id = $2`,
      [req.params.id, req.employerId]
    );
    
    if (appResult.rows.length === 0) {
      return res.status(404).json({ error: 'Application not found' });
    }
    
    const application = appResult.rows[0];
    
    // Determine new status based on gate and approval
    let newStatus = application.current_status;
    let stageField = null;
    
    if (gateName === 'shortlist') {
      newStatus = approved ? 'shortlisted' : 'rejected_screening';
      stageField = 'shortlist_approved_at';
    } else if (gateName === 'test_review') {
      newStatus = approved ? 'ai_interview' : 'rejected_test';
      stageField = 'test_approved_at';
    } else if (gateName === 'final_interview') {
      newStatus = approved ? 'final_interview' : 'rejected_ai_interview';
      stageField = 'ai_interview_approved_at';
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
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Approve application error:', error);
    res.status(500).json({ error: 'Failed to process approval' });
  }
});

module.exports = router;
