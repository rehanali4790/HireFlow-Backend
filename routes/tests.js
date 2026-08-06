const express = require('express');
const authMiddleware = require('../middleware/auth');
const { checkPermission } = require('../middleware/permissions');
const { getActor, logActivity } = require('../middleware/audit-log');
const { isPlatformWide, resolveEmployerIdForApplication } = require('../utils/platform-scope');
const { getAppUrl } = require('../config/app');
const router = express.Router();

async function applyApplicationUpdater(db, req, applicationId, employerIdOverride = null) {
  const employerId = employerIdOverride || req.employerId || await resolveEmployerIdForApplication(db, req, applicationId);
  const actor = await getActor(db, req.userId, employerId);
  await db.query(
    `UPDATE applications
     SET updated_by_name = $1,
         updated_by_email = $2,
         updated_at = NOW()
     WHERE id = $3`,
    [actor.actorName, actor.actorEmail, applicationId]
  );
}

async function logCandidateNotification(req, event) {
  await logActivity(req, {
    employerId: event.employerId,
    actorName: event.candidateName,
    actorEmail: event.candidateEmail,
    action: event.action,
    resourceType: 'candidate_notifications',
    resourceId: event.applicationId,
    statusCode: 200,
    details: {
      event_type: event.eventType,
      title: event.title,
      message: event.message,
      severity: event.severity,
      candidate_name: event.candidateName,
      candidate_email: event.candidateEmail,
      job_title: event.jobTitle,
      test_title: event.testTitle,
      score: event.score,
      percentage: event.percentage,
      passed: event.passed,
      reason: event.reason,
    },
  });
}

// Get all tests for employer (authenticated)
router.get('/', authMiddleware, checkPermission('tests', 'read'), async (req, res) => {
  const db = req.app.locals.db;
  
  try {
    const platformWide = isPlatformWide(req);
    if (!platformWide && !req.employerId) {
      return res.status(400).json({ error: 'Company context required' });
    }

    const result = platformWide
      ? await db.query(
          `SELECT t.*, j.title as job_title
           FROM tests t
           LEFT JOIN jobs j ON t.job_id = j.id
           ORDER BY t.created_at DESC`
        )
      : await db.query(
          `SELECT t.*, j.title as job_title
           FROM tests t
           LEFT JOIN jobs j ON t.job_id = j.id
           WHERE t.employer_id = $1
           ORDER BY t.created_at DESC`,
          [req.employerId]
        );
    
    // Map status to is_active for frontend compatibility
    const tests = result.rows.map(test => ({
      ...test,
      is_active: test.status === 'active'
    }));
    
    res.json({ tests });
  } catch (error) {
    console.error('Get tests error:', error);
    res.status(500).json({ error: 'Failed to fetch tests' });
  }
});

// Get single test
router.get('/:id', async (req, res) => {
  const db = req.app.locals.db;
  
  try {
    const result = await db.query(
      'SELECT * FROM tests WHERE id = $1',
      [req.params.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Test not found' });
    }
    
    const test = result.rows[0];
    
    // Ensure questions is parsed as array
    if (typeof test.questions === 'string') {
      test.questions = JSON.parse(test.questions);
    }
    
    // Ensure answer_key is parsed as object
    if (typeof test.answer_key === 'string') {
      test.answer_key = JSON.parse(test.answer_key);
    }
    
    res.json(test);
  } catch (error) {
    console.error('Get test error:', error);
    res.status(500).json({ error: 'Failed to fetch test' });
  }
});

// Create test (authenticated)
router.post('/', authMiddleware, checkPermission('tests', 'write'), async (req, res) => {
  const db = req.app.locals.db;
  const {
    jobId,
    title,
    description,
    testType,
    durationMinutes,
    passingScore,
    questions,
  } = req.body;
  
  try {
    const actor = await getActor(db, req.userId, req.employerId);
    // Verify job belongs to employer
    const jobCheck = await db.query(
      'SELECT id FROM jobs WHERE id = $1 AND employer_id = $2',
      [jobId, req.employerId]
    );
    
    if (jobCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Job not found' });
    }
    
    // Build answer key from questions
    const answerKey = {};
    if (questions && Array.isArray(questions)) {
      questions.forEach((q, index) => {
        if (q.correct_answer) {
          answerKey[index] = q.correct_answer;
        }
      });
    }
    
    const result = await db.query(
      `INSERT INTO tests (
        job_id, employer_id, title, description, test_type,
        duration_minutes, passing_score, questions, answer_key,
        status, ai_evaluation_enabled, is_ai_generated, updated_by_name, updated_by_email, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW(), NOW())
      RETURNING *`,
      [
        jobId, 
        req.employerId, 
        title, 
        description || '', 
        testType || 'technical',
        durationMinutes || 45, 
        passingScore || 70, 
        JSON.stringify(questions || []),
        JSON.stringify(answerKey),
        'active',
        false,
        false,
        actor.actorName,
        actor.actorEmail
      ]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create test error:', error);
    res.status(500).json({ error: 'Failed to create test' });
  }
});

// Submit test (public - by application ID)
router.post('/:id/submit', async (req, res) => {
  const db = req.app.locals.db;
  const { applicationId, answers } = req.body;
  
  try {
    // Get test
    const testResult = await db.query(
      'SELECT * FROM tests WHERE id = $1',
      [req.params.id]
    );
    
    if (testResult.rows.length === 0) {
      return res.status(404).json({ error: 'Test not found' });
    }

    const cancelledAttempt = await db.query(
      `SELECT id, is_expired, submitted_at, extension_reason
       FROM test_attempts
       WHERE application_id = $1 AND test_id = $2`,
      [applicationId, req.params.id]
    );

    if (cancelledAttempt.rows.length > 0) {
      const attempt = cancelledAttempt.rows[0];
      if (attempt.is_expired && !attempt.submitted_at) {
        return res.status(403).json({
          error: 'Test attempt was cancelled. Please contact HR for retake approval.',
          cancelled: true,
        });
      }
    }

    const applicationResult = await db.query(
      'SELECT status FROM applications WHERE id = $1',
      [applicationId]
    );

    if (applicationResult.rows[0]?.status === 'test_cancelled') {
      return res.status(403).json({
        error: 'Test was cancelled due to a proctoring violation. Please contact HR for retake approval.',
        cancelled: true,
      });
    }
    
    const test = testResult.rows[0];
    
    // Parse questions and answer_key if they're strings
    const questions = typeof test.questions === 'string' ? JSON.parse(test.questions) : test.questions || [];
    const answerKey = typeof test.answer_key === 'string' ? JSON.parse(test.answer_key) : test.answer_key || {};
    
    console.log('📝 Test Scoring Debug:');
    console.log('Questions:', JSON.stringify(questions, null, 2));
    console.log('Answer Key:', JSON.stringify(answerKey, null, 2));
    console.log('User Answers:', JSON.stringify(answers, null, 2));
    
    // Calculate score
    let score = 0;
    let maxScore = 0;
    let autoGradedScore = 0;
    let autoGradedMaxScore = 0;
    let manualReviewNeeded = false;
    
    questions.forEach((question, index) => {
      const points = question.points || 1;
      maxScore += points;
      
      const userAnswer = answers[index];
      const correctAnswer = answerKey[index];
      const questionType = question.type || 'multiple_choice';
      
      console.log(`Question ${index} (${questionType}):`, {
        userAnswer,
        correctAnswer,
        points
      });
      
      // Only auto-grade multiple choice questions
      if (questionType === 'multiple_choice' && correctAnswer) {
        autoGradedMaxScore += points;
        
        if (userAnswer === correctAnswer) {
          score += points;
          autoGradedScore += points;
          console.log(`  ✓ CORRECT - Awarded ${points} points`);
        } else {
          console.log(`  ✗ INCORRECT - Expected: ${correctAnswer}, Got: ${userAnswer}`);
        }
      } else if (questionType === 'short_answer' || questionType === 'essay' || questionType === 'coding') {
        // For essay/short answer questions, give full credit if answered
        // These need manual review
        manualReviewNeeded = true;
        if (userAnswer && userAnswer.trim().length > 0) {
          score += points; // Give full credit for now
          console.log(`  📝 ESSAY ANSWERED - Awarded ${points} points (needs manual review)`);
        } else {
          console.log(`  📝 ESSAY NOT ANSWERED`);
        }
      }
    });
    
    console.log('Final Score:', { 
      score, 
      maxScore, 
      autoGradedScore,
      autoGradedMaxScore,
      percentage: (score / maxScore) * 100,
      manualReviewNeeded 
    });
    
    const percentage = maxScore > 0 ? (score / maxScore) * 100 : 0;
    const passed = percentage >= test.passing_score;
    
    // Check if test attempt already exists
    const existingAttempt = await db.query(
      `SELECT id FROM test_attempts WHERE application_id = $1 AND test_id = $2`,
      [applicationId, req.params.id]
    );
    
    let attemptResult;
    if (existingAttempt.rows.length > 0) {
      // Update existing attempt
      attemptResult = await db.query(
        `UPDATE test_attempts SET
          submitted_at = NOW(),
          answers = $1,
          score = $2,
          max_score = $3,
          percentage = $4,
          passed = $5
        WHERE application_id = $6 AND test_id = $7
        RETURNING *`,
        [JSON.stringify(answers), score, maxScore, percentage, passed, applicationId, req.params.id]
      );
      console.log('✅ Updated existing test attempt');
    } else {
      // Create new attempt
      attemptResult = await db.query(
        `INSERT INTO test_attempts (
          application_id, test_id, started_at, submitted_at,
          answers, score, max_score, percentage, passed, created_at
        ) VALUES ($1, $2, NOW(), NOW(), $3, $4, $5, $6, $7, NOW())
        RETURNING *`,
        [applicationId, req.params.id, JSON.stringify(answers), score, maxScore, percentage, passed]
      );
      console.log('✅ Created new test attempt');
    }
    
    // Update application status
    await db.query(
      `UPDATE applications
       SET status = 'test_completed', test_completed_at = NOW(), updated_at = NOW()
       WHERE id = $1`,
      [applicationId]
    );

    const notificationResult = await db.query(
      `SELECT a.id as application_id, c.first_name, c.last_name, c.email,
              j.title as job_title, j.employer_id, t.title as test_title
       FROM applications a
       LEFT JOIN candidates c ON a.candidate_id = c.id
       LEFT JOIN jobs j ON a.job_id = j.id
       LEFT JOIN tests t ON t.id = $2
       WHERE a.id = $1`,
      [applicationId, req.params.id]
    );

    if (notificationResult.rows.length > 0) {
      const row = notificationResult.rows[0];
      const candidateName = `${row.first_name || ''} ${row.last_name || ''}`.trim() || row.email || 'Candidate';
      await logCandidateNotification(req, {
        employerId: row.employer_id,
        applicationId,
        candidateName,
        candidateEmail: row.email,
        jobTitle: row.job_title,
        testTitle: row.test_title || test.title,
        action: 'completed',
        eventType: 'test_completed',
        severity: 'success',
        title: 'Test Completed',
        message: `${candidateName} completed ${row.test_title || test.title || 'the test'} for ${row.job_title || 'the job'}.`,
        score,
        percentage,
        passed,
      });
    }
    
    res.json({
      success: true,
      attempt: attemptResult.rows[0],
      passed,
      score,
      maxScore,
      percentage,
    });
  } catch (error) {
    console.error('Submit test error:', error);
    res.status(500).json({ error: 'Failed to submit test' });
  }
});

// Cancel test attempt after proctoring violation (public - candidate tab switch/blur)
router.post('/:id/cancel', async (req, res) => {
  const db = req.app.locals.db;
  const { applicationId, reason } = req.body;

  try {
    if (!applicationId) {
      return res.status(400).json({ error: 'Application ID is required' });
    }

    const existingAttempt = await db.query(
      `SELECT id FROM test_attempts WHERE application_id = $1 AND test_id = $2`,
      [applicationId, req.params.id]
    );

    if (existingAttempt.rows.length > 0) {
      await db.query(
        `UPDATE test_attempts
         SET is_expired = true,
             extension_reason = $1,
             updated_at = NOW()
         WHERE id = $2`,
        [reason || 'Cancelled due to tab switch / focus loss', existingAttempt.rows[0].id]
      );
    } else {
      await db.query(
        `INSERT INTO test_attempts (
          application_id, test_id, started_at, link_sent_at, link_expires_at,
          is_expired, extension_reason, created_at
        ) VALUES ($1, $2, NOW(), NOW(), NOW(), true, $3, NOW())`,
        [applicationId, req.params.id, reason || 'Cancelled due to tab switch / focus loss']
      );
    }

    await db.query(
      `UPDATE applications
       SET status = 'test_cancelled',
           rejection_reason = $1,
           updated_at = NOW()
       WHERE id = $2`,
      [reason || 'Test cancelled due to tab switch / focus loss. HR approval required for retake.', applicationId]
    );

    const notificationResult = await db.query(
      `SELECT a.id as application_id, c.first_name, c.last_name, c.email,
              j.title as job_title, j.employer_id, t.title as test_title
       FROM applications a
       LEFT JOIN candidates c ON a.candidate_id = c.id
       LEFT JOIN jobs j ON a.job_id = j.id
       LEFT JOIN tests t ON t.id = $2
       WHERE a.id = $1`,
      [applicationId, req.params.id]
    );

    if (notificationResult.rows.length > 0) {
      const row = notificationResult.rows[0];
      const candidateName = `${row.first_name || ''} ${row.last_name || ''}`.trim() || row.email || 'Candidate';
      const violationReason = reason || 'Tab switch / focus loss detected during test.';
      await logCandidateNotification(req, {
        employerId: row.employer_id,
        applicationId,
        candidateName,
        candidateEmail: row.email,
        jobTitle: row.job_title,
        testTitle: row.test_title,
        action: 'violation',
        eventType: 'test_proctoring_violation',
        severity: 'warning',
        title: 'Test Proctoring Violation',
        message: `${candidateName} triggered a test proctoring violation: ${violationReason}`,
        reason: violationReason,
      });
    }

    res.json({
      success: true,
      cancelled: true,
      message: 'Test cancelled due to proctoring violation. Please contact HR for retake approval.'
    });
  } catch (error) {
    console.error('Cancel test attempt error:', error);
    res.status(500).json({ error: 'Failed to cancel test attempt' });
  }
});

// Get test attempts for a test (authenticated)
router.get('/:id/attempts', authMiddleware, checkPermission('tests', 'read'), async (req, res) => {
  const db = req.app.locals.db;
  
  try {
    const result = await db.query(
      `SELECT ta.*, a.id as application_id, c.first_name, c.last_name, c.email
       FROM test_attempts ta
       LEFT JOIN applications a ON ta.application_id = a.id
       LEFT JOIN candidates c ON a.candidate_id = c.id
       LEFT JOIN jobs j ON a.job_id = j.id
       WHERE ta.test_id = $1 AND j.employer_id = $2
       ORDER BY ta.submitted_at DESC`,
      [req.params.id, req.employerId]
    );
    
    res.json(result.rows);
  } catch (error) {
    console.error('Get test attempts error:', error);
    res.status(500).json({ error: 'Failed to fetch test attempts' });
  }
});

// Update test (authenticated)
router.put('/:id', authMiddleware, checkPermission('tests', 'edit'), async (req, res) => {
  const db = req.app.locals.db;
  const {
    jobId,
    title,
    description,
    testType,
    durationMinutes,
    passingScore,
    questions,
  } = req.body;
  
  try {
    const actor = await getActor(db, req.userId, req.employerId);
    // Verify test belongs to employer
    const testCheck = await db.query(
      'SELECT id FROM tests WHERE id = $1 AND employer_id = $2',
      [req.params.id, req.employerId]
    );
    
    if (testCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Test not found or unauthorized' });
    }
    
    // If jobId is being changed, verify new job belongs to employer
    if (jobId) {
      const jobCheck = await db.query(
        'SELECT id FROM jobs WHERE id = $1 AND employer_id = $2',
        [jobId, req.employerId]
      );
      
      if (jobCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Job not found' });
      }
    }
    
    // Build answer key from questions if provided
    let answerKey = null;
    if (questions && Array.isArray(questions)) {
      answerKey = {};
      questions.forEach((q, index) => {
        if (q.correct_answer) {
          answerKey[index] = q.correct_answer;
        }
      });
    }
    
    const result = await db.query(
      `UPDATE tests SET
        job_id = COALESCE($1, job_id),
        title = COALESCE($2, title),
        description = COALESCE($3, description),
        test_type = COALESCE($4, test_type),
        duration_minutes = COALESCE($5, duration_minutes),
        passing_score = COALESCE($6, passing_score),
        questions = COALESCE($7, questions),
        answer_key = COALESCE($8, answer_key),
        updated_by_name = $9,
        updated_by_email = $10,
        updated_at = NOW()
      WHERE id = $11 AND employer_id = $12
      RETURNING *`,
      [
        jobId,
        title,
        description,
        testType,
        durationMinutes,
        passingScore,
        questions ? JSON.stringify(questions) : null,
        answerKey ? JSON.stringify(answerKey) : null,
        actor.actorName,
        actor.actorEmail,
        req.params.id,
        req.employerId
      ]
    );
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update test error:', error);
    res.status(500).json({ error: 'Failed to update test' });
  }
});

// Delete test (authenticated)
router.delete('/:id', authMiddleware, checkPermission('tests', 'delete'), async (req, res) => {
  const db = req.app.locals.db;
  
  try {
    const result = await db.query(
      'DELETE FROM tests WHERE id = $1 AND employer_id = $2 RETURNING id',
      [req.params.id, req.employerId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Test not found or unauthorized' });
    }
    
    res.json({ success: true, message: 'Test deleted successfully' });
  } catch (error) {
    console.error('Delete test error:', error);
    res.status(500).json({ error: 'Failed to delete test' });
  }
});

// Send test invitation to candidate (authenticated)
router.post('/send-invitation', authMiddleware, checkPermission('tests', 'write'), async (req, res) => {
  const db = req.app.locals.db;
  const { applicationId } = req.body;
  
  try {
    const employerId = await resolveEmployerIdForApplication(db, req, applicationId);
    if (!employerId) {
      return res.status(400).json({ error: 'Company context required' });
    }

    // Get application details
    const appResult = await db.query(
      `SELECT a.*, c.first_name, c.last_name, c.email, j.title as job_title, j.id as job_id
       FROM applications a
       LEFT JOIN candidates c ON a.candidate_id = c.id
       LEFT JOIN jobs j ON a.job_id = j.id
       WHERE a.id = $1 AND j.employer_id = $2`,
      [applicationId, employerId]
    );
    
    if (appResult.rows.length === 0) {
      return res.status(404).json({ error: 'Application not found' });
    }
    
    const application = appResult.rows[0];

    const status = String(application.status || '').toLowerCase();
    if (status === 'hired' || application.hire_date || application.hired_at) {
      return res.status(400).json({ error: 'This candidate is already hired. Test cannot be sent.' });
    }
    
    // Get test for this job
    const testResult = await db.query(
      `SELECT * FROM tests 
       WHERE job_id = $1 AND employer_id = $2 AND status = 'active'
       ORDER BY created_at DESC
       LIMIT 1`,
      [application.job_id, employerId]
    );
    
    if (testResult.rows.length === 0) {
      return res.status(404).json({ error: 'No active test found for this job. Please create a test first.' });
    }
    
    const test = testResult.rows[0];
    
    // Check if test attempt already exists
    const existingAttempt = await db.query(
      `SELECT * FROM test_attempts 
       WHERE application_id = $1 AND test_id = $2`,
      [applicationId, test.id]
    );
    
    let testAttempt;
    if (existingAttempt.rows.length > 0) {
      testAttempt = existingAttempt.rows[0];
      
      if (!testAttempt.submitted_at) {
        const resetResult = await db.query(
          `UPDATE test_attempts
           SET link_sent_at = NOW(),
               link_expires_at = NOW() + INTERVAL '24 hours',
               is_expired = false,
               extension_reason = NULL,
               updated_at = NOW()
           WHERE id = $1
           RETURNING *`,
          [testAttempt.id]
        );
        testAttempt = resetResult.rows[0];
      }

      // Check if link has expired
      const now = new Date();
      const expiresAt = new Date(testAttempt.link_expires_at);
      
      if (now > expiresAt && !testAttempt.submitted_at) {
        // Link expired and test not submitted - update expiration
        await db.query(
          `UPDATE test_attempts 
           SET is_expired = true, updated_at = NOW()
           WHERE id = $1`,
          [testAttempt.id]
        );
        
        return res.status(400).json({ 
          error: 'Test link has expired. Please contact HR to request an extension.',
          expired: true
        });
      }
    } else {
      // Create new test attempt with 24-hour expiration
      const attemptResult = await db.query(
        `INSERT INTO test_attempts (
          application_id, test_id, 
          link_sent_at, link_expires_at, 
          created_at
        ) VALUES ($1, $2, NOW(), NOW() + INTERVAL '24 hours', NOW())
        RETURNING *`,
        [applicationId, test.id]
      );
      testAttempt = attemptResult.rows[0];
    }
    
    // Generate test link
    const testLink = `${getAppUrl()}/test/${test.id}?application=${applicationId}`;
    
    // Parse questions to get count
    const questions = typeof test.questions === 'string' ? JSON.parse(test.questions) : test.questions || [];
    
    // Send email with actual test details from database (set by HR)
    const emailService = require('../services/email-service');
    
    // Get employer industry for email template
    const employerResult = await db.query(
      'SELECT e.industry FROM employers e JOIN jobs j ON e.id = j.employer_id WHERE j.id = $1',
      [application.job_id]
    );
    const industry = employerResult.rows[0]?.industry || 'other';
    
    await emailService.sendTestInvitation(
      application.email,
      `${application.first_name} ${application.last_name}`,
      application.job_title,
      testLink,
      {
        duration: test.duration_minutes,
        questionCount: questions.length,
        passingScore: test.passing_score,
        expiryDays: 1, // Changed to 1 day (24 hours)
        testType: test.test_type === 'technical' ? 'Technical Assessment (MCQs)' : 
                  test.test_type === 'coding' ? 'Coding Challenge' :
                  test.test_type === 'behavioral' ? 'Behavioral Assessment' :
                  'Multiple Choice Questions (MCQs)',
        industry: industry
      }
    );
    
    // Update application status
    await db.query(
      `UPDATE applications 
       SET status = 'testing',
           rejection_reason = NULL,
           updated_at = NOW()
       WHERE id = $1`,
      [applicationId]
    );
    await applyApplicationUpdater(db, req, applicationId, employerId);
    
    res.json({
      success: true,
      message: 'Test invitation sent successfully',
      testLink,
      expiresAt: testAttempt.link_expires_at
    });
  } catch (error) {
    console.error('Send test invitation error:', error);
    res.status(500).json({ error: error.message || 'Failed to send test invitation' });
  }
});

// Check if test link is expired (public - for candidates)
router.get('/check-expiration/:testId', async (req, res) => {
  const db = req.app.locals.db;
  const { testId } = req.params;
  const { application } = req.query;
  
  try {
    if (!application) {
      return res.status(400).json({ error: 'Application ID is required' });
    }
    
    // Get test attempt
    const attemptResult = await db.query(
      `SELECT * FROM test_attempts 
       WHERE application_id = $1 AND test_id = $2`,
      [application, testId]
    );
    
    if (attemptResult.rows.length === 0) {
      // No attempt yet - link is valid
      const applicationResult = await db.query(
        'SELECT status FROM applications WHERE id = $1',
        [application]
      );

      if (applicationResult.rows[0]?.status === 'test_cancelled') {
        return res.status(403).json({
          expired: true,
          cancelled: true,
          message: 'This test was cancelled due to a proctoring violation. Please contact HR for retake approval.',
        });
      }

      return res.json({ expired: false, valid: true });
    }
    
    const attempt = attemptResult.rows[0];
    
    // Check if already submitted
    if (attempt.submitted_at) {
      return res.json({ 
        expired: false, 
        valid: true,
        submitted: true,
        message: 'Test already submitted'
      });
    }

    if (attempt.is_expired) {
      return res.status(403).json({
        expired: true,
        cancelled: true,
        message: attempt.extension_reason || 'This test was cancelled due to a proctoring violation. Please contact HR for retake approval.',
        expiresAt: attempt.link_expires_at
      });
    }
    
    // Check expiration
    const now = new Date();
    const expiresAt = new Date(attempt.link_expires_at);
    
    if (now > expiresAt) {
      // Update expiration status
      await db.query(
        `UPDATE test_attempts 
         SET is_expired = true, updated_at = NOW()
         WHERE id = $1`,
        [attempt.id]
      );
      
      return res.status(403).json({ 
        expired: true,
        message: 'This test link has expired after 24 hours. Please contact HR to request an extension.',
        expiresAt: attempt.link_expires_at
      });
    }
    
    // Link is still valid
    res.json({ 
      expired: false, 
      valid: true,
      expiresAt: attempt.link_expires_at,
      timeRemaining: Math.floor((expiresAt - now) / 1000 / 60) // minutes
    });
    
  } catch (error) {
    console.error('Check expiration error:', error);
    res.status(500).json({ error: 'Failed to check test expiration' });
  }
});

// Extend test link expiration (authenticated - HR only)
router.post('/extend-link/:applicationId', authMiddleware, checkPermission('tests', 'edit'), async (req, res) => {
  const db = req.app.locals.db;
  const { applicationId } = req.params;
  const { reason, extensionHours } = req.body;
  
  try {
    const employerId = await resolveEmployerIdForApplication(db, req, applicationId);
    if (!employerId) {
      return res.status(400).json({ error: 'Company context required' });
    }

    // Verify application belongs to employer
    const appCheck = await db.query(
      `SELECT a.*, j.employer_id 
       FROM applications a
       LEFT JOIN jobs j ON a.job_id = j.id
       WHERE a.id = $1 AND j.employer_id = $2`,
      [applicationId, employerId]
    );
    
    if (appCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Application not found' });
    }

    const application = appCheck.rows[0];
    const status = String(application.status || '').toLowerCase();
    if (status === 'hired' || application.hire_date || application.hired_at) {
      return res.status(400).json({ error: 'This candidate is already hired. Test link cannot be extended.' });
    }
    
    // Get test attempt
    const attemptResult = await db.query(
      `SELECT ta.*, t.id as test_id
       FROM test_attempts ta
       LEFT JOIN tests t ON ta.test_id = t.id
       WHERE ta.application_id = $1`,
      [applicationId]
    );
    
    if (attemptResult.rows.length === 0) {
      return res.status(404).json({ error: 'No test attempt found for this application' });
    }
    
    const attempt = attemptResult.rows[0];
    
    // Check if test already submitted
    if (attempt.submitted_at) {
      return res.status(400).json({ error: 'Test has already been submitted' });
    }
    
    // Extend the link (default 24 hours if not specified)
    const hours = extensionHours || 24;
    const newExpiresAt = new Date();
    newExpiresAt.setHours(newExpiresAt.getHours() + hours);
    
    await db.query(
      `UPDATE test_attempts 
       SET link_expires_at = $1,
           link_extended_at = NOW(),
           extension_reason = $2,
           is_expired = false,
           updated_at = NOW()
       WHERE id = $3`,
      [newExpiresAt, reason || 'Extended by HR', attempt.id]
    );

    await db.query(
      `UPDATE applications
       SET status = 'testing',
           rejection_reason = NULL,
           updated_at = NOW()
       WHERE id = $1`,
      [applicationId]
    );
    
    console.log(`✅ Test link extended for application ${applicationId} until ${newExpiresAt}`);
    
    res.json({
      success: true,
      message: `Test link extended by ${hours} hours`,
      newExpiresAt
    });
  } catch (error) {
    console.error('Extend test link error:', error);
    res.status(500).json({ error: 'Failed to extend test link' });
  }
});

module.exports = router;
