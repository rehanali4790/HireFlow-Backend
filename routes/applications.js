const express = require('express');
const authMiddleware = require('../middleware/auth');
const { checkPermission, checkAnyPermission, applicationReadPermissions, applicationEditPermissions, applicationWritePermissions } = require('../middleware/permissions');
const { isPlatformWide, resolveEmployerIdForApplication } = require('../utils/platform-scope');
const { getActor } = require('../middleware/audit-log');
const { syncJobPositions } = require('../utils/job-positions');
const {
  PIPELINE_STAGES,
  MOVE_TARGETS,
  statusToStage,
  ensurePipelineEventsTable,
  logPipelineEvent,
} = require('../utils/pipeline-events');
const router = express.Router();

function isSuperAdminRequest(req) {
  return Boolean(req.isSuperAdmin || req.userType === 'super_admin');
}

function isRejectedStatus(status) {
  const s = (status || '').toLowerCase();
  return s === 'rejected' || s.startsWith('rejected_') || s === 'test_cancelled' || s === 'ai_interview_cancelled';
}

/** Resolve tenant for app actions; SA without X-Tenant-Id uses job's employer. */
async function requireApplicationEmployer(db, req, applicationId) {
  const employerId = await resolveEmployerIdForApplication(db, req, applicationId);
  if (!employerId) {
    return { ok: false, status: 400, error: 'Company context required' };
  }
  return { ok: true, employerId };
}

/** Fire-and-forget rejection email to candidate (optional HR message in body) */
async function sendRejectionEmailForApplication(db, applicationId, employerId, rejectionMessage = '') {
  const emailService = require('../services/email-service');
  const result = await db.query(
    `SELECT c.email AS candidate_email, c.first_name, c.last_name,
            j.title AS job_title, e.company_name, e.industry
     FROM applications a
     LEFT JOIN candidates c ON a.candidate_id = c.id
     LEFT JOIN jobs j ON a.job_id = j.id
     LEFT JOIN employers e ON j.employer_id = e.id
     WHERE a.id = $1 AND j.employer_id = $2`,
    [applicationId, employerId]
  );
  if (result.rows.length === 0) return;
  const row = result.rows[0];
  if (!row.candidate_email) {
    console.warn(`⚠️ No candidate email for application ${applicationId} — skip rejection email`);
    return;
  }
  const candidateName = `${row.first_name || ''} ${row.last_name || ''}`.trim() || 'Candidate';
  emailService
    .sendRejectionEmail(
      row.candidate_email,
      candidateName,
      row.job_title || 'the position',
      row.company_name || 'HireFlow',
      row.industry || 'other',
      rejectionMessage || ''
    )
    .catch((err) => console.error('❌ Error sending rejection email:', err));
}

async function ensureFinalScoringTable(db) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS final_scoring (
      application_id UUID PRIMARY KEY REFERENCES applications(id) ON DELETE CASCADE,
      parameters JSONB NOT NULL DEFAULT '[]'::jsonb,
      final_score NUMERIC(5,2) NOT NULL DEFAULT 0,
      ai_decision TEXT,
      recommendation VARCHAR(50),
      updated_by_name TEXT,
      updated_by_email TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

/**
 * Touch application updated_at. Super Admin never writes updated_by_* history.
 */
async function applyApplicationUpdater(db, req, applicationId, employerIdOverride = null) {
  if (isSuperAdminRequest(req)) {
    await db.query(
      `UPDATE applications SET updated_at = NOW() WHERE id = $1`,
      [applicationId]
    );
    return { actorName: null, actorEmail: null, skipHistory: true };
  }

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
  return { ...actor, skipHistory: false };
}

function attachUpdaterToRow(row, actor) {
  if (!actor?.skipHistory) {
    row.updated_by_name = actor.actorName;
    row.updated_by_email = actor.actorEmail;
  }
  row.updated_at = new Date().toISOString();
  return row;
}

function pipelineActorFields(actor) {
  if (actor?.skipHistory) {
    return { actorName: null, actorEmail: null };
  }
  return { actorName: actor?.actorName || null, actorEmail: actor?.actorEmail || null };
}

async function resolveActorForRequest(db, req, employerId) {
  if (isSuperAdminRequest(req)) {
    return { actorName: null, actorEmail: null, skipHistory: true };
  }
  const actor = await getActor(db, req.userId, employerId);
  return { ...actor, skipHistory: false };
}

// Get all applications (authenticated - employer's jobs only)
// Candidates page is gated by candidates.read but needs application rows.
router.get('/', authMiddleware, checkAnyPermission([
  ...applicationReadPermissions,
]), async (req, res) => {
  const db = req.app.locals.db;
  
  try {
    const platformWide = isPlatformWide(req);
    // Overview / reporting can request full history including blacklisted rows.
    const includeAll = ['1', 'true', 'yes'].includes(String(req.query.include_all || '').toLowerCase());

    const blacklistClause = includeAll
      ? ''
      : `AND lower(COALESCE(a.status, '')) <> 'blacklisted'
         AND NOT EXISTS (
           SELECT 1 FROM candidate_blacklist b
           WHERE b.employer_id = j.employer_id
             AND b.candidate_id = a.candidate_id
             AND b.removed_at IS NULL
         )`;

    const result = platformWide
      ? await db.query(
          `SELECT a.*, 
                  c.first_name, c.last_name, c.email, c.phone, c.resume_url, c.picture_url, c.skills, c.certifications,
                  j.title as job_title, j.location as job_location, j.employer_id,
                  rs.overall_score, rs.recommendation,
                  ta.passed as test_passed, ta.score as test_score, 
                  ta.max_score as test_max_score, ta.percentage as test_percentage,
                  fs.final_score, fs.recommendation as final_scoring_recommendation,
                  fs.updated_at as final_scoring_updated_at
           FROM applications a
           LEFT JOIN candidates c ON a.candidate_id = c.id
           LEFT JOIN jobs j ON a.job_id = j.id
           LEFT JOIN resume_scores rs ON a.id = rs.application_id
           LEFT JOIN test_attempts ta ON a.id = ta.application_id
           LEFT JOIN final_scoring fs ON a.id = fs.application_id
           WHERE TRUE
             ${blacklistClause}
           ORDER BY a.application_date DESC`
        )
      : await db.query(
          `SELECT a.*, 
                  c.first_name, c.last_name, c.email, c.phone, c.resume_url, c.picture_url, c.skills, c.certifications,
                  j.title as job_title, j.location as job_location,
                  rs.overall_score, rs.recommendation,
                  ta.passed as test_passed, ta.score as test_score, 
                  ta.max_score as test_max_score, ta.percentage as test_percentage,
                  fs.final_score, fs.recommendation as final_scoring_recommendation,
                  fs.updated_at as final_scoring_updated_at
           FROM applications a
           LEFT JOIN candidates c ON a.candidate_id = c.id
           LEFT JOIN jobs j ON a.job_id = j.id
           LEFT JOIN resume_scores rs ON a.id = rs.application_id
           LEFT JOIN test_attempts ta ON a.id = ta.application_id
           LEFT JOIN final_scoring fs ON a.id = fs.application_id
           WHERE j.employer_id = $1
             ${includeAll ? '' : `AND lower(COALESCE(a.status, '')) <> 'blacklisted'
             AND NOT EXISTS (
               SELECT 1 FROM candidate_blacklist b
               WHERE b.employer_id = $1
                 AND b.candidate_id = a.candidate_id
                 AND b.removed_at IS NULL
             )`}
           ORDER BY a.application_date DESC`,
          [req.employerId]
        );
    
    res.json(result.rows);
  } catch (error) {
    console.error('Get applications error:', error);
    res.status(500).json({ error: 'Failed to fetch applications' });
  }
});

// Pipeline analytics funnel (must be before /:id)
router.get('/pipeline-analytics', authMiddleware, checkAnyPermission(applicationReadPermissions), async (req, res) => {
  const db = req.app.locals.db;
  const jobId = req.query.job_id || null;

  try {
    await ensurePipelineEventsTable(db);
    await ensureFinalScoringTable(db);
    const platformWide = isPlatformWide(req);
    if (!platformWide && !req.employerId) {
      return res.status(400).json({ error: 'Company context required' });
    }

    const appsResult = platformWide
      ? await db.query(
          `SELECT a.id, a.status, a.job_id, a.interview_date, a.interview_time,
                  a.final_interview_scheduled_at, a.final_interview_rating, a.hired_at,
                  a.skip_test, a.skip_ai_interview, a.skip_final_interview,
                  a.application_date, a.updated_at, a.updated_by_name, a.updated_by_email,
                  c.first_name, c.last_name, c.email, c.phone, c.skills, c.resume_url, c.picture_url,
                  j.title as job_title,
                  rs.overall_score,
                  ta.passed as test_passed, ta.score as test_score, ta.percentage as test_percentage,
                  ai.id as ai_interview_id, ai.overall_score as ai_overall_score, ai.completed_at as ai_completed_at,
                  ai.recommendation as ai_recommendation,
                  fs.final_score, fs.recommendation as final_scoring_recommendation,
                  fs.updated_at as final_scoring_updated_at
           FROM applications a
           LEFT JOIN candidates c ON a.candidate_id = c.id
           LEFT JOIN jobs j ON a.job_id = j.id
           LEFT JOIN resume_scores rs ON a.id = rs.application_id
           LEFT JOIN final_scoring fs ON a.id = fs.application_id
           LEFT JOIN LATERAL (
             SELECT * FROM test_attempts t WHERE t.application_id = a.id ORDER BY t.created_at DESC NULLS LAST LIMIT 1
           ) ta ON true
           LEFT JOIN LATERAL (
             SELECT * FROM ai_interviews i WHERE i.application_id = a.id ORDER BY i.created_at DESC NULLS LAST LIMIT 1
           ) ai ON true
           WHERE ($1::uuid IS NULL OR a.job_id = $1::uuid)
             AND lower(COALESCE(a.status, '')) <> 'blacklisted'
             AND NOT EXISTS (
               SELECT 1 FROM candidate_blacklist b
               WHERE b.employer_id = j.employer_id
                 AND b.candidate_id = a.candidate_id
                 AND b.removed_at IS NULL
             )
           ORDER BY a.application_date DESC`,
          [jobId]
        )
      : await db.query(
          `SELECT a.id, a.status, a.job_id, a.interview_date, a.interview_time,
                  a.final_interview_scheduled_at, a.final_interview_rating, a.hired_at,
                  a.skip_test, a.skip_ai_interview, a.skip_final_interview,
                  a.application_date, a.updated_at, a.updated_by_name, a.updated_by_email,
                  c.first_name, c.last_name, c.email, c.phone, c.skills, c.resume_url, c.picture_url,
                  j.title as job_title,
                  rs.overall_score,
                  ta.passed as test_passed, ta.score as test_score, ta.percentage as test_percentage,
                  ai.id as ai_interview_id, ai.overall_score as ai_overall_score, ai.completed_at as ai_completed_at,
                  ai.recommendation as ai_recommendation,
                  fs.final_score, fs.recommendation as final_scoring_recommendation,
                  fs.updated_at as final_scoring_updated_at
           FROM applications a
           LEFT JOIN candidates c ON a.candidate_id = c.id
           LEFT JOIN jobs j ON a.job_id = j.id
           LEFT JOIN resume_scores rs ON a.id = rs.application_id
           LEFT JOIN final_scoring fs ON a.id = fs.application_id
           LEFT JOIN LATERAL (
             SELECT * FROM test_attempts t WHERE t.application_id = a.id ORDER BY t.created_at DESC NULLS LAST LIMIT 1
           ) ta ON true
           LEFT JOIN LATERAL (
             SELECT * FROM ai_interviews i WHERE i.application_id = a.id ORDER BY i.created_at DESC NULLS LAST LIMIT 1
           ) ai ON true
           WHERE j.employer_id = $1
             AND ($2::uuid IS NULL OR a.job_id = $2::uuid)
             AND lower(COALESCE(a.status, '')) <> 'blacklisted'
             AND NOT EXISTS (
               SELECT 1 FROM candidate_blacklist b
               WHERE b.employer_id = $1
                 AND b.candidate_id = a.candidate_id
                 AND b.removed_at IS NULL
             )
           ORDER BY a.application_date DESC`,
          [req.employerId, jobId]
        );

    const applications = appsResult.rows;

    const stageStats = PIPELINE_STAGES.map((stage) => {
      const current = applications.filter((a) => stage.statuses.includes((a.status || '').toLowerCase()));
      return {
        id: stage.id,
        label: stage.label,
        statuses: stage.statuses,
        current_count: current.length,
        hired_in_bucket: current.filter((a) => (a.status || '').toLowerCase() === 'hired').length,
      };
    });

    // Historical pass-through from events
    const eventsAgg = platformWide
      ? await db.query(
          `SELECT e.stage, e.action, COUNT(*)::int AS count
           FROM application_pipeline_events e
           JOIN applications a ON a.id = e.application_id
           JOIN jobs j ON j.id = a.job_id
           WHERE ($1::uuid IS NULL OR a.job_id = $1::uuid)
           GROUP BY e.stage, e.action`,
          [jobId]
        )
      : await db.query(
          `SELECT e.stage, e.action, COUNT(*)::int AS count
           FROM application_pipeline_events e
           JOIN applications a ON a.id = e.application_id
           JOIN jobs j ON j.id = a.job_id
           WHERE j.employer_id = $1
             AND ($2::uuid IS NULL OR a.job_id = $2::uuid)
           GROUP BY e.stage, e.action`,
          [req.employerId, jobId]
        );

    const historyByStage = {};
    for (const row of eventsAgg.rows) {
      if (!historyByStage[row.stage]) historyByStage[row.stage] = { completed: 0, skipped: 0, moved: 0, started: 0 };
      if (row.action === 'completed') historyByStage[row.stage].completed = row.count;
      else if (row.action === 'skipped') historyByStage[row.stage].skipped = row.count;
      else if (row.action === 'moved') historyByStage[row.stage].moved = row.count;
      else if (row.action === 'started') historyByStage[row.stage].started = row.count;
    }

    // Derived activity counts from related tables (visible even without events)
    const derived = {
      tests_taken: applications.filter((a) => a.test_score != null || a.test_percentage != null || a.test_passed != null).length,
      tests_passed: applications.filter((a) => a.test_passed === true).length,
      ai_interviews: applications.filter((a) => a.ai_interview_id).length,
      ai_completed: applications.filter((a) => a.ai_completed_at).length,
      hr_interviews_scheduled: applications.filter((a) => a.interview_date || a.final_interview_scheduled_at).length,
      hired: applications.filter((a) => (a.status || '').toLowerCase() === 'hired').length,
      rejected: applications.filter((a) => statusToStage(a.status) === 'rejected').length,
      on_hold: applications.filter((a) => statusToStage(a.status) === 'on_hold').length,
      call_screening: applications.filter((a) => statusToStage(a.status) === 'call').length,
      hod_interview: applications.filter((a) => statusToStage(a.status) === 'hod_interview').length,
    };

    const stages = stageStats.map((s) => ({
      ...s,
      history: historyByStage[s.id] || { completed: 0, skipped: 0, moved: 0, started: 0 },
    }));

    res.json({
      total: applications.length,
      stages,
      derived,
      move_targets: MOVE_TARGETS,
      applications,
    });
  } catch (error) {
    console.error('Pipeline analytics error:', error);
    res.status(500).json({ error: 'Failed to load pipeline analytics', message: error.message });
  }
});

// Get single application
router.get('/:id', authMiddleware, checkAnyPermission([
  { resource: 'applications', action: 'read' },
  { resource: 'candidates', action: 'read' },
]), async (req, res) => {
  const db = req.app.locals.db;
  
  try {
    // Super admin without a selected company can read any application (same as list)
    const platformWide = isPlatformWide(req);
    if (!platformWide && !req.employerId) {
      return res.status(400).json({ error: 'Company context required' });
    }

    const result = platformWide
      ? await db.query(
          `SELECT 
            a.id as application_id,
            a.job_id,
            a.candidate_id,
            a.status,
            a.current_stage,
            a.application_date,
            a.interview_date,
            a.interview_time,
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
           WHERE a.id = $1`,
          [req.params.id]
        )
      : await db.query(
          `SELECT 
            a.id as application_id,
            a.job_id,
            a.candidate_id,
            a.status,
            a.current_stage,
            a.application_date,
            a.interview_date,
            a.interview_time,
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

    const application = result.rows[0];

    const prescreeningResult = await db.query(
      `SELECT apa.*, pq.question_type, pq.is_predefined
       FROM application_prescreening_answers apa
       LEFT JOIN prescreening_questions pq ON pq.id = apa.question_id
       WHERE apa.application_id = $1
       ORDER BY apa.created_at ASC`,
      [req.params.id]
    );

    res.json({
      ...application,
      prescreening_answers: prescreeningResult.rows,
    });
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
    prescreeningAnswers,
    referredBy,
  } = req.body;

  const referredByName = typeof referredBy === 'string' ? referredBy.trim() : '';
  
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

    // Validate prescreening answers for enabled required questions
    const { getEnabledPrescreeningForJob } = require('./prescreening');
    const enabledQuestions = await getEnabledPrescreeningForJob(db, jobId);
    const answersMap = {};
    if (Array.isArray(prescreeningAnswers)) {
      prescreeningAnswers.forEach((a) => {
        if (a.question_id) answersMap[a.question_id] = a.answer;
      });
    }

    for (const q of enabledQuestions) {
      if (!q.is_required) continue;
      const answer = answersMap[q.question_id];
      if (!answer || !String(answer).trim()) {
        return res.status(400).json({
          error: `Please answer the required prescreening question: "${q.question_text}"`,
        });
      }
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

    // Blacklist guard: keep application for audit, but never enter hiring pipeline
    const jobEmployer = await db.query(
      'SELECT employer_id, title FROM jobs WHERE id = $1',
      [jobId]
    );
    const employerIdForJob = jobEmployer.rows[0]?.employer_id;
    const { findActiveBlacklist, logBlacklistEvent } = require('./blacklist');
    const activeBlacklist = employerIdForJob
      ? await findActiveBlacklist(db, employerIdForJob, {
          candidateId,
          email,
          phone,
        })
      : null;

    const initialStatus = activeBlacklist ? 'blacklisted' : 'new';
    const initialStage = activeBlacklist ? 'blacklisted' : 'application_received';
    
    // Create application
    const applicationResult = await db.query(
      `INSERT INTO applications (
        job_id, candidate_id, status, current_stage, referred_by,
        application_date, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, NOW(), NOW(), NOW())
      RETURNING *`,
      [jobId, candidateId, initialStatus, initialStage, referredByName || null]
    );
    
    const application = applicationResult.rows[0];

    if (activeBlacklist) {
      await logBlacklistEvent(db, {
        employerId: employerIdForJob,
        candidateId,
        applicationId: application.id,
        action: 'reapply_blocked',
        reason: activeBlacklist.reason,
        actorName: 'System',
        actorEmail: null,
        metadata: {
          job_id: jobId,
          job_title: jobEmployer.rows[0]?.title || null,
          blacklist_id: activeBlacklist.id,
        },
      });

      try {
        const { logPipelineEvent } = require('../utils/pipeline-events');
        await logPipelineEvent(db, {
          applicationId: application.id,
          stage: 'blacklisted',
          action: 'reapply_blocked',
          fromStatus: null,
          toStatus: 'blacklisted',
          outcome: 'blacklisted',
          notes: `Re-apply blocked: ${activeBlacklist.reason}`,
          actorName: 'System',
          metadata: { blacklist_id: activeBlacklist.id },
        });
      } catch (logErr) {
        console.warn('Blacklist pipeline log skipped:', logErr.message);
      }
    }

    // Save prescreening answers
    if (enabledQuestions.length > 0) {
      for (const q of enabledQuestions) {
        const answer = answersMap[q.question_id] || null;
        await db.query(
          `INSERT INTO application_prescreening_answers (
            application_id, question_id, question_text, answer, is_required
          ) VALUES ($1, $2, $3, $4, $5)`,
          [application.id, q.question_id, q.question_text, answer, q.is_required]
        );
      }
    }

    // Blacklisted re-applies stay out of hiring pipeline (no AI scoring / no confirmation funnel)
    if (activeBlacklist) {
      return res.status(201).json({
        ...application,
        blacklisted: true,
        message: 'Application received but candidate is blacklisted. It will not enter the hiring pipeline.',
      });
    }
    
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
        
        // Keep pipeline status as 'new' until HR takes an action
        await db.query(
          `UPDATE applications
           SET overall_score = $1, screening_completed_at = NOW()
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
router.patch('/:id/status', authMiddleware, checkAnyPermission(applicationEditPermissions), async (req, res) => {
  const db = req.app.locals.db;
  const { status, notes, rejectionMessage } = req.body;
  
  try {
    const scoped = await requireApplicationEmployer(db, req, req.params.id);
    if (!scoped.ok) return res.status(scoped.status).json({ error: scoped.error });
    const employerId = scoped.employerId;

    // Check if application belongs to employer's job
    const checkResult = await db.query(
      `SELECT a.id, a.job_id, a.status AS current_status FROM applications a
       LEFT JOIN jobs j ON a.job_id = j.id
       WHERE a.id = $1 AND j.employer_id = $2`,
      [req.params.id, employerId]
    );
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Application not found' });
    }

    const application = checkResult.rows[0];
    const nextStatus = (status || '').toLowerCase();
    const wasHired = (application.current_status || '').toLowerCase() === 'hired';
    const hrMessage = typeof rejectionMessage === 'string' ? rejectionMessage.trim() : '';

    if (nextStatus === 'hired' && !wasHired) {
      const positionState = await syncJobPositions(db, application.job_id);
      if (positionState?.is_full) {
        return res.status(400).json({
          error: 'No open positions left for this job. Increase openings on the Jobs page first.',
          positions: positionState,
        });
      }
    }
    
    // Update application (keep current_stage in sync so Candidates / Pipeline filters stay correct)
    const previousStatus = application.current_status;
    const nextStage = statusToStage(nextStatus);
    const result = await db.query(
      `UPDATE applications
       SET status = $1,
           current_stage = $5,
           employer_notes = COALESCE($2, employer_notes),
           rejection_reason = CASE
             WHEN $1::text ILIKE 'rejected%' AND $4::text IS NOT NULL AND LENGTH(TRIM($4::text)) > 0
             THEN TRIM($4::text)
             ELSE rejection_reason
           END,
           hired_at = CASE WHEN $1 = 'hired' THEN COALESCE(hired_at, NOW()) ELSE hired_at END,
           updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [status, notes, req.params.id, isRejectedStatus(nextStatus) ? (hrMessage || notes || null) : null, nextStage]
    );
    const actor = await applyApplicationUpdater(db, req, req.params.id);
    attachUpdaterToRow(result.rows[0], actor);

    await logPipelineEvent(db, {
      applicationId: req.params.id,
      stage: statusToStage(nextStatus),
      action: previousStatus === nextStatus ? 'updated' : 'moved',
      fromStatus: previousStatus,
      toStatus: nextStatus,
      outcome: nextStatus,
      notes: notes || hrMessage || null,
      ...pipelineActorFields(actor),
    });

    if (isRejectedStatus(nextStatus) && !isRejectedStatus(previousStatus)) {
      sendRejectionEmailForApplication(db, req.params.id, employerId, hrMessage || notes || '');
    }

    const positions = await syncJobPositions(db, application.job_id);
    res.json({ ...result.rows[0], positions });
  } catch (error) {
    console.error('Update application status error:', error);
    res.status(500).json({ error: 'Failed to update application' });
  }
});

// Move / skip to any pipeline stage (HR can jump ahead)
router.post('/:id/move-stage', authMiddleware, checkAnyPermission(applicationEditPermissions), async (req, res) => {
  const db = req.app.locals.db;
  const { toStatus, notes, skippedStages, rejectionMessage } = req.body;

  try {
    const target = MOVE_TARGETS.find((t) => t.status === (toStatus || '').toLowerCase());
    if (!target) {
      return res.status(400).json({ error: 'Invalid target status', allowed: MOVE_TARGETS.map((t) => t.status) });
    }

    const scoped = await requireApplicationEmployer(db, req, req.params.id);
    if (!scoped.ok) return res.status(scoped.status).json({ error: scoped.error });
    const employerId = scoped.employerId;

    const checkResult = await db.query(
      `SELECT a.id, a.job_id, a.status AS current_status,
              a.skip_test, a.skip_ai_interview, a.skip_final_interview
       FROM applications a
       LEFT JOIN jobs j ON a.job_id = j.id
       WHERE a.id = $1 AND j.employer_id = $2`,
      [req.params.id, employerId]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Application not found' });
    }

    const application = checkResult.rows[0];
    const previousStatus = application.current_status;
    const wasHired = (previousStatus || '').toLowerCase() === 'hired';
    const hrMessage = typeof rejectionMessage === 'string' ? rejectionMessage.trim() : '';

    if (target.status === 'hired' && !wasHired) {
      const positionState = await syncJobPositions(db, application.job_id);
      if (positionState?.is_full) {
        return res.status(400).json({
          error: 'No open positions left for this job. Increase openings on the Jobs page first.',
          positions: positionState,
        });
      }
    }

    const skipTest = Boolean(skippedStages?.includes('test') || application.skip_test);
    const skipAi = Boolean(skippedStages?.includes('ai_interview') || application.skip_ai_interview);
    const skipFinal = Boolean(skippedStages?.includes('hr_interview') || application.skip_final_interview);
    const noteForDb = notes || (isRejectedStatus(target.status) ? hrMessage : null) || null;

    const result = await db.query(
      `UPDATE applications
       SET status = $1,
           current_stage = $2,
           skip_test = $3,
           skip_ai_interview = $4,
           skip_final_interview = $5,
           employer_notes = COALESCE($6, employer_notes),
           rejection_reason = CASE
             WHEN $1::text ILIKE 'rejected%' AND $8::text IS NOT NULL AND LENGTH(TRIM($8::text)) > 0
             THEN TRIM($8::text)
             ELSE rejection_reason
           END,
           hired_at = CASE WHEN $1 = 'hired' THEN COALESCE(hired_at, NOW()) ELSE hired_at END,
           updated_at = NOW()
       WHERE id = $7
       RETURNING *`,
      [
        target.status,
        target.stage,
        skipTest,
        skipAi,
        skipFinal,
        noteForDb,
        req.params.id,
        isRejectedStatus(target.status) ? (hrMessage || notes || null) : null,
      ]
    );

    const actor = await applyApplicationUpdater(db, req, req.params.id);
    attachUpdaterToRow(result.rows[0], actor);

    const fromStage = statusToStage(previousStatus);
    const action = fromStage === target.stage ? 'moved' : (
      // jumping forward past stages counts as skip+move
      PIPELINE_STAGES.findIndex((s) => s.id === target.stage) >
      PIPELINE_STAGES.findIndex((s) => s.id === fromStage)
        ? 'skipped'
        : 'moved'
    );

    await logPipelineEvent(db, {
      applicationId: req.params.id,
      stage: target.stage,
      action: action === 'skipped' ? 'skipped' : 'moved',
      fromStatus: previousStatus,
      toStatus: target.status,
      outcome: target.status,
      notes: noteForDb || `Moved from ${previousStatus} to ${target.status}`,
      ...pipelineActorFields(actor),
      metadata: { skippedStages: skippedStages || [], fromStage, toStage: target.stage },
    });

    // Also log skipped intermediate stages
    if (Array.isArray(skippedStages)) {
      for (const stageId of skippedStages) {
        await logPipelineEvent(db, {
          applicationId: req.params.id,
          stage: stageId,
          action: 'skipped',
          fromStatus: previousStatus,
          toStatus: target.status,
          notes: notes || `Stage skipped while moving to ${target.status}`,
          ...pipelineActorFields(actor),
        });
      }
    }

    if (isRejectedStatus(target.status) && !isRejectedStatus(previousStatus)) {
      sendRejectionEmailForApplication(db, req.params.id, employerId, hrMessage || notes || '');
    }

    const positions = await syncJobPositions(db, application.job_id);
    res.json({
      success: true,
      application: result.rows[0],
      from_status: previousStatus,
      to_status: target.status,
      positions,
    });
  } catch (error) {
    console.error('Move stage error:', error);
    res.status(500).json({ error: 'Failed to move pipeline stage', message: error.message });
  }
});

// Timeline / events for one application
router.get('/:id/pipeline-events', authMiddleware, checkAnyPermission(applicationReadPermissions), async (req, res) => {
  const db = req.app.locals.db;
  try {
    await ensurePipelineEventsTable(db);
    const scoped = await requireApplicationEmployer(db, req, req.params.id);
    if (!scoped.ok) return res.status(scoped.status).json({ error: scoped.error });

    const check = await db.query(
      `SELECT a.id FROM applications a
       JOIN jobs j ON j.id = a.job_id
       WHERE a.id = $1 AND j.employer_id = $2`,
      [req.params.id, scoped.employerId]
    );
    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'Application not found' });
    }

    const events = await db.query(
      `SELECT * FROM application_pipeline_events
       WHERE application_id = $1
       ORDER BY created_at ASC`,
      [req.params.id]
    );
    res.json({ events: events.rows, stages: PIPELINE_STAGES });
  } catch (error) {
    console.error('Pipeline events error:', error);
    res.status(500).json({ error: 'Failed to load pipeline events' });
  }
});

// Update per-candidate pipeline skip settings (authenticated)
router.patch('/:id/pipeline-skips', authMiddleware, checkAnyPermission(applicationEditPermissions), async (req, res) => {
  const db = req.app.locals.db;
  const {
    skip_test = false,
    skip_ai_interview = false,
    skip_final_interview = false,
  } = req.body;

  try {
    const scoped = await requireApplicationEmployer(db, req, req.params.id);
    if (!scoped.ok) return res.status(scoped.status).json({ error: scoped.error });
    const employerId = scoped.employerId;

    // Check if application belongs to employer's job
    const checkResult = await db.query(
      `SELECT a.id FROM applications a
       LEFT JOIN jobs j ON a.job_id = j.id
       WHERE a.id = $1 AND j.employer_id = $2`,
      [req.params.id, employerId]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Application not found' });
    }

    const result = await db.query(
      `UPDATE applications
       SET skip_test = $1,
           skip_ai_interview = $2,
           skip_final_interview = $3,
           updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [
        Boolean(skip_test),
        Boolean(skip_ai_interview),
        Boolean(skip_final_interview),
        req.params.id,
      ]
    );
    const actor = await applyApplicationUpdater(db, req, req.params.id);
    attachUpdaterToRow(result.rows[0], actor);

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update pipeline skips error:', error);
    res.status(500).json({ error: 'Failed to update pipeline skips' });
  }
});

// Approve/reject at approval gate (authenticated)
router.post('/:id/approve', authMiddleware, checkAnyPermission(applicationEditPermissions), async (req, res) => {
  const db = req.app.locals.db;
  const { gateName, approved, notes, rejectionMessage } = req.body;
  const emailService = require('../services/email-service');
  const hrMessage = typeof rejectionMessage === 'string' ? rejectionMessage.trim() : (typeof notes === 'string' ? notes.trim() : '');
  
  try {
    const scoped = await requireApplicationEmployer(db, req, req.params.id);
    if (!scoped.ok) return res.status(scoped.status).json({ error: scoped.error });
    const employerId = scoped.employerId;

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
      [req.params.id, employerId]
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
      // Approve from details modal → reviewing (call/screening is next)
      newStatus = approved ? 'reviewing' : 'rejected';
      stageField = 'shortlist_approved_at';
      nextSteps = 'phone screening';
    } else if (gateName === 'test_review') {
      newStatus = approved ? 'reviewing' : 'rejected';
      stageField = 'test_approved_at';
      nextSteps = 'phone screening';
    } else if (gateName === 'final_interview') {
      newStatus = approved ? 'interviewing' : 'rejected';
      stageField = 'ai_interview_approved_at';
      nextSteps = 'interview';
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
    const actor = await applyApplicationUpdater(db, req, req.params.id);
    attachUpdaterToRow(result.rows[0], actor);
    
    // Log approval gate decision
    await db.query(
      `INSERT INTO approval_gates (
        application_id, gate_name, approved, approved_by,
        decision_date, notes, previous_status, new_status, created_at
      ) VALUES ($1, $2, $3, $4, NOW(), $5, $6, $7, NOW())`,
      [req.params.id, gateName, approved, employerId, notes,
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
        industry,
        hrMessage
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
router.post('/:id/final-interview-complete', authMiddleware, checkAnyPermission(applicationEditPermissions), async (req, res) => {
  const db = req.app.locals.db;
  const { interviewerName, notes, rating, recommendation } = req.body;
  
  try {
    const scoped = await requireApplicationEmployer(db, req, req.params.id);
    if (!scoped.ok) return res.status(scoped.status).json({ error: scoped.error });
    const employerId = scoped.employerId;

    // Check if application belongs to employer's job
    const checkResult = await db.query(
      `SELECT a.id FROM applications a
       LEFT JOIN jobs j ON a.job_id = j.id
       WHERE a.id = $1 AND j.employer_id = $2`,
      [req.params.id, employerId]
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
    await applyApplicationUpdater(db, req, req.params.id, employerId);
    
    console.log('✅ Final interview marked as completed');
    
    res.json({ success: true, message: 'Final interview completed' });
  } catch (error) {
    console.error('Complete final interview error:', error);
    res.status(500).json({ error: 'Failed to complete final interview' });
  }
});

// Mark as hired (authenticated)
router.post('/:id/mark-hired', authMiddleware, checkAnyPermission(applicationEditPermissions), async (req, res) => {
  const db = req.app.locals.db;
  const emailService = require('../services/email-service');
  
  try {
    const scoped = await requireApplicationEmployer(db, req, req.params.id);
    if (!scoped.ok) return res.status(scoped.status).json({ error: scoped.error });
    const employerId = scoped.employerId;

    // Get application details
    const appResult = await db.query(
      `SELECT a.*, c.first_name, c.last_name, c.email, j.title as job_title, e.company_name
       FROM applications a
       LEFT JOIN candidates c ON a.candidate_id = c.id
       LEFT JOIN jobs j ON a.job_id = j.id
       LEFT JOIN employers e ON j.employer_id = e.id
       WHERE a.id = $1 AND j.employer_id = $2`,
      [req.params.id, employerId]
    );
    
    if (appResult.rows.length === 0) {
      return res.status(404).json({ error: 'Application not found' });
    }
    
    const application = appResult.rows[0];
    const candidateName = `${application.first_name} ${application.last_name}`;
    const alreadyHired = (application.status || '').toLowerCase() === 'hired';

    if (!alreadyHired) {
      const positionState = await syncJobPositions(db, application.job_id);
      if (positionState?.is_full) {
        return res.status(400).json({
          error: 'No open positions left for this job. Increase openings on the Jobs page first.',
          positions: positionState,
        });
      }
    }
    
    // Update application to hired
    await db.query(
      `UPDATE applications
       SET status = 'hired',
           hired_at = COALESCE(hired_at, NOW()),
           updated_at = NOW()
       WHERE id = $1`,
      [req.params.id]
    );
    await applyApplicationUpdater(db, req, req.params.id, employerId);

    const hireActor = await resolveActorForRequest(db, req, employerId);
    await logPipelineEvent(db, {
      applicationId: req.params.id,
      stage: 'hired',
      action: 'completed',
      fromStatus: application.status || application.current_status,
      toStatus: 'hired',
      outcome: 'hired',
      notes: 'Marked as hired',
      ...pipelineActorFields(hireActor),
    });

    const positions = await syncJobPositions(db, application.job_id);
    
    console.log('✅ Candidate marked as hired', positions);
    
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
    
    res.json({
      success: true,
      message: 'Candidate marked as hired',
      positions,
    });
  } catch (error) {
    console.error('Mark as hired error:', error);
    res.status(500).json({ error: 'Failed to mark as hired' });
  }
});

// Schedule HOD or HR interview (separate pipeline funnels)
router.post('/:id/schedule-final-interview', authMiddleware, checkAnyPermission(applicationWritePermissions), async (req, res) => {
  const db = req.app.locals.db;
  const { interviewDate, interviewTime, interviewType, location, interviewers, additionalNotes } = req.body;
  const pipelineStage = String(req.body.pipelineStage || req.body.interviewStage || 'hr').toLowerCase();
  const isHodInterview = pipelineStage === 'hod';
  
  try {
    const scoped = await requireApplicationEmployer(db, req, req.params.id);
    if (!scoped.ok) return res.status(scoped.status).json({ error: scoped.error });
    const employerId = scoped.employerId;

    // Get application details
    const appResult = await db.query(
      `SELECT a.*, c.first_name, c.last_name, c.email, j.title as job_title, e.company_name
       FROM applications a
       JOIN candidates c ON a.candidate_id = c.id
       JOIN jobs j ON a.job_id = j.id
       JOIN employers e ON j.employer_id = e.id
       WHERE a.id = $1 AND j.employer_id = $2`,
      [req.params.id, employerId]
    );
    
    if (appResult.rows.length === 0) {
      return res.status(404).json({ error: 'Application not found' });
    }
    
    const application = appResult.rows[0];
    const nextStatus = isHodInterview ? 'hod_interview' : 'interviewing';
    const nextStage = isHodInterview ? 'hod_interview' : 'hr_interview';
    const interviewLabel = isHodInterview ? 'HOD Interview' : 'HR / Final Interview';
    
    // Keep HOD and HR in separate funnels — do not mix statuses
    await db.query(
      `UPDATE applications 
       SET status = $2,
           current_stage = $3,
           interview_date = $4,
           interview_time = $5,
           final_interview_scheduled_at = CASE WHEN $6 THEN final_interview_scheduled_at ELSE NOW() END,
           updated_at = NOW()
       WHERE id = $1`,
      [req.params.id, nextStatus, nextStage, interviewDate || null, interviewTime || null, isHodInterview]
    );
    await applyApplicationUpdater(db, req, req.params.id, employerId);

    const actor = await resolveActorForRequest(db, req, employerId);
    await logPipelineEvent(db, {
      applicationId: req.params.id,
      stage: nextStage,
      action: 'started',
      fromStatus: application.status,
      toStatus: nextStatus,
      notes: `${interviewLabel} scheduled for ${interviewDate} ${interviewTime || ''}`.trim(),
      ...pipelineActorFields(actor),
      metadata: { interviewDate, interviewTime, interviewType, pipelineStage: isHodInterview ? 'hod' : 'hr' },
    });
    
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
      `${interviewLabel} Scheduled - ${application.job_title}`,
      `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 28px;">📅 ${interviewLabel} Scheduled!</h1>
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
      message: `${interviewLabel} scheduled successfully`,
      status: nextStatus,
      stage: nextStage,
      interviewDate: formattedDate,
      interviewTime: formattedTime
    });
  } catch (error) {
    console.error('Schedule final interview error:', error);
    res.status(500).json({ error: 'Failed to schedule final interview' });
  }
});

// Final Scoring Analysis (authenticated)
router.post('/:id/final-scoring', authMiddleware, checkAnyPermission(applicationEditPermissions), async (req, res) => {
  const db = req.app.locals.db;
  const { parameters } = req.body;

  try {
    if (!Array.isArray(parameters) || parameters.length === 0) {
      return res.status(400).json({ error: 'At least one scoring parameter is required' });
    }

    await ensureFinalScoringTable(db);

    const scoped = await requireApplicationEmployer(db, req, req.params.id);
    if (!scoped.ok) return res.status(scoped.status).json({ error: scoped.error });
    const employerId = scoped.employerId;

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
      [req.params.id, employerId]
    );

    if (appResult.rows.length === 0) {
      return res.status(404).json({ error: 'Application not found' });
    }

    const application = appResult.rows[0];

    // Get AI interview data if available
    let aiInterview = null;
    try {
      const aiInterviewResult = await db.query(
        `SELECT overall_score, communication_score, technical_score, problem_solving_score
         FROM ai_interviews
         WHERE application_id = $1`,
        [req.params.id]
      );
      aiInterview = aiInterviewResult.rows[0] || null;
    } catch (aiInterviewError) {
      console.warn('Could not load AI interview scores for final scoring:', aiInterviewError.message);
    }

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
${parameters.map((p) => {
  const pct = p.maxScore > 0 ? ((p.achievedScore / p.maxScore) * 100).toFixed(1) : '0.0';
  return `- ${p.name || 'Parameter'}: ${p.achievedScore}/${p.maxScore} (${pct}%)`;
}).join('\n')}

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

    const actor = await resolveActorForRequest(db, req, employerId);

    // Store the final scoring in database (SA never writes updated_by_*)
    if (actor.skipHistory) {
      await db.query(
        `INSERT INTO final_scoring (
           application_id, parameters, final_score, ai_decision, recommendation,
           created_at, updated_at
         )
         VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
         ON CONFLICT (application_id) 
         DO UPDATE SET
           parameters = $2,
           final_score = $3,
           ai_decision = $4,
           recommendation = $5,
           updated_at = NOW()`,
        [req.params.id, JSON.stringify(parameters), finalScore, aiDecision, recommendation]
      );
    } else {
      await db.query(
        `INSERT INTO final_scoring (
           application_id, parameters, final_score, ai_decision, recommendation,
           updated_by_name, updated_by_email, created_at, updated_at
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
         ON CONFLICT (application_id) 
         DO UPDATE SET
           parameters = $2,
           final_score = $3,
           ai_decision = $4,
           recommendation = $5,
           updated_by_name = $6,
           updated_by_email = $7,
           updated_at = NOW()`,
        [req.params.id, JSON.stringify(parameters), finalScore, aiDecision, recommendation, actor.actorName, actor.actorEmail]
      );
    }

    // Keep pipeline status as-is — final scoring must not yank candidates back to reviewing
    await applyApplicationUpdater(db, req, req.params.id);

    console.log('✅ Final scoring saved');

    const saved = await db.query(
      `SELECT updated_by_name, updated_by_email, updated_at
       FROM final_scoring WHERE application_id = $1`,
      [req.params.id]
    );
    const savedRow = saved.rows[0] || {};

    res.json({
      success: true,
      finalScore: finalScore,
      decision: aiDecision,
      recommendation: recommendation,
      updatedByName: savedRow.updated_by_name || null,
      updatedByEmail: savedRow.updated_by_email || null,
      updatedAt: savedRow.updated_at || new Date().toISOString(),
    });
  } catch (error) {
    console.error('Final scoring error:', error);
    res.status(500).json({ error: error.message || 'Failed to process final scoring' });
  }
});

// Get Final Scoring Data (authenticated)
router.get('/:id/final-scoring', authMiddleware, checkAnyPermission(applicationReadPermissions), async (req, res) => {
  const db = req.app.locals.db;

  try {
    await ensureFinalScoringTable(db);

    const result = await db.query(
      `SELECT parameters, final_score, ai_decision, recommendation,
              updated_by_name, updated_by_email, created_at, updated_at
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
      updatedByName: scoring.updated_by_name,
      updatedByEmail: scoring.updated_by_email,
      createdAt: scoring.created_at,
      updatedAt: scoring.updated_at,
    });
  } catch (error) {
    console.error('Get final scoring error:', error);
    res.status(500).json({ error: 'Failed to retrieve final scoring' });
  }
});

module.exports = router;
