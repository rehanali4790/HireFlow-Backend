const express = require('express');
const authMiddleware = require('../middleware/auth');
const { checkPermission } = require('../middleware/permissions');
const { getActor } = require('../middleware/audit-log');
const { generateJobContent } = require('../services/ai-service');
const { syncJobPositions } = require('../utils/job-positions');
const { getJobPrescreeningSettings, getDefaultPrescreeningSettings, saveJobPrescreeningSettings } = require('./prescreening');
const { resolveOptionalAuth, isPlatformWide } = require('../utils/platform-scope');
const router = express.Router();

function assertJobAccess(db, req, jobId) {
  if (isPlatformWide(req)) {
    return db.query('SELECT id, employer_id FROM jobs WHERE id = $1', [jobId]).then((r) => r.rows[0] || null);
  }

  if (!req.employerId) {
    return Promise.resolve(null);
  }

  return db.query(
    'SELECT id, employer_id FROM jobs WHERE id = $1 AND employer_id = $2',
    [jobId, req.employerId]
  ).then((r) => r.rows[0] || null);
}

function isSuperAdminRequest(req) {
  return Boolean(req.isSuperAdmin || req.userType === 'super_admin');
}

const JOB_UPDATABLE_FIELDS = new Set([
  'title',
  'description',
  'requirements',
  'responsibilities',
  'skills_required',
  'location',
  'department',
  'work_type',
  'remote_policy',
  'salary_min',
  'salary_max',
  'salary_currency',
  'experience_level',
  'education_required',
  'status',
  'application_deadline',
  'positions_available',
]);

function mapJobJdFields(row) {
  return {
    id: row.id,
    job_title: row.title,
    job_description: row.description,
    requirements: row.requirements || null,
    responsibilities: row.responsibilities || null,
    required_skills: Array.isArray(row.skills_required) ? row.skills_required : [],
  };
}

// Get job posting content for all employer jobs (title, description, requirements, etc.)
router.get('/jd', authMiddleware, checkPermission('jobs', 'read'), async (req, res) => {
  const db = req.app.locals.db;

  try {
    const platformWide = isPlatformWide(req);
    if (!platformWide && !req.employerId) {
      return res.status(400).json({ error: 'Company context required' });
    }

    const result = platformWide
      ? await db.query(
          `SELECT id, title, description, requirements, responsibilities, skills_required
           FROM jobs
           ORDER BY created_at DESC`
        )
      : await db.query(
          `SELECT id, title, description, requirements, responsibilities, skills_required
           FROM jobs
           WHERE employer_id = $1
           ORDER BY created_at DESC`,
          [req.employerId]
        );

    res.json({
      jobs: result.rows.map(mapJobJdFields),
      total: result.rows.length,
    });
  } catch (error) {
    console.error('Get jobs JD list error:', error);
    res.status(500).json({ error: 'Failed to fetch job content' });
  }
});

// Get all jobs (public - only active, authenticated - all own jobs)
router.get('/', async (req, res) => {
  const db = req.app.locals.db;
  const headerEmployerId = req.headers['x-employer-id'] || req.headers['x-tenant-id'] || null;
  const optionalAuth = resolveOptionalAuth(req);
  const employerId = headerEmployerId || optionalAuth.employerId || null;
  const platformWideJobs = optionalAuth.isSuperAdmin && !employerId;
  
  try {
    let query;
    let params = [];
    
    if (platformWideJobs) {
      query = `
        SELECT j.*, e.company_name, e.company_logo_url
        FROM jobs j
        LEFT JOIN employers e ON j.employer_id = e.id
        ORDER BY j.created_at DESC
      `;
    } else if (employerId) {
      // Get all jobs for this employer
      query = `
        SELECT j.*, e.company_name, e.company_logo_url
        FROM jobs j
        LEFT JOIN employers e ON j.employer_id = e.id
        WHERE j.employer_id = $1
        ORDER BY j.created_at DESC
      `;
      params = [employerId];
    } else {
      // Public - only active jobs
      query = `
        SELECT j.*, e.company_name, e.company_logo_url
        FROM jobs j
        LEFT JOIN employers e ON j.employer_id = e.id
        WHERE j.status = 'active'
        ORDER BY j.created_at DESC
      `;
    }
    
    const result = await db.query(query, params);

    if (employerId || platformWideJobs) {
      const syncedJobs = [];
      for (const job of result.rows) {
        const positions = await syncJobPositions(db, job.id);
        syncedJobs.push({
          ...job,
          positions_available: positions?.positions_available ?? job.positions_available,
          positions_filled: positions?.positions_filled ?? job.positions_filled,
          status: positions?.status ?? job.status,
        });
      }
      return res.json({ jobs: syncedJobs });
    }

    res.json({ jobs: result.rows });
  } catch (error) {
    console.error('Get jobs error:', error);
    res.status(500).json({ error: 'Failed to fetch jobs' });
  }
});

// Get single job
router.get('/:id', async (req, res) => {
  const db = req.app.locals.db;
  
  try {
    const result = await db.query(
      `SELECT j.*, e.company_name, e.company_logo_url, e.company_description, e.website
       FROM jobs j
       LEFT JOIN employers e ON j.employer_id = e.id
       WHERE j.id = $1`,
      [req.params.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Job not found' });
    }

    const job = result.rows[0];
    let allSettings = await getJobPrescreeningSettings(db, req.params.id);

    if (allSettings.length === 0) {
      allSettings = await getDefaultPrescreeningSettings(db);
    }

    const prescreeningQuestions = allSettings
      .filter((s) => s.is_enabled)
      .map((s) => ({
        id: s.question_id,
        question_text: s.question_text,
        question_type: s.question_type,
        options: s.options,
        is_required: s.is_required,
        is_predefined: s.is_predefined,
        sort_order: s.sort_order,
      }));

    res.json({ ...job, prescreening_questions: prescreeningQuestions });
  } catch (error) {
    console.error('Get job error:', error);
    res.status(500).json({ error: 'Failed to fetch job' });
  }
});

// Get single job posting content (JD fields only)
router.get('/:id/jd', async (req, res) => {
  const db = req.app.locals.db;
  const employerId = req.headers['x-employer-id'];

  try {
    const result = await db.query(
      `SELECT id, employer_id, title, description, requirements, responsibilities, skills_required, status
       FROM jobs
       WHERE id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Job not found' });
    }

    const job = result.rows[0];

    if (!employerId) {
      if (job.status !== 'active') {
        return res.status(404).json({ error: 'Job not found' });
      }
    } else if (job.employer_id !== employerId) {
      return res.status(404).json({ error: 'Job not found' });
    }

    res.json({ job: mapJobJdFields(job) });
  } catch (error) {
    console.error('Get job JD error:', error);
    res.status(500).json({ error: 'Failed to fetch job content' });
  }
});

// Generate job content with AI (authenticated)
router.post('/generate-content', authMiddleware, checkPermission('jobs', 'write'), async (req, res) => {
  const { prompt } = req.body;

  if (!prompt || !String(prompt).trim()) {
    return res.status(400).json({ error: 'Prompt is required' });
  }

  try {
    const content = await generateJobContent(String(prompt).trim());
    res.json(content);
  } catch (error) {
    console.error('Generate job content error:', error);
    res.status(500).json({ error: 'Failed to generate job content' });
  }
});

// Create job (authenticated)
router.post('/', authMiddleware, checkPermission('jobs', 'write'), async (req, res) => {
  const db = req.app.locals.db;
  const {
    title,
    description,
    requirements,
    responsibilities,
    skills_required,
    location,
    department,
    work_type,
    remote_policy,
    salary_min,
    salary_max,
    salary_currency,
    experience_level,
    education_required,
    status,
    application_deadline,
    positions_available,
    prescreening_settings,
  } = req.body;
  
  try {
    if (!req.employerId) {
      return res.status(400).json({ error: 'Company context required' });
    }

    const skipActorHistory = isSuperAdminRequest(req);
    const actor = skipActorHistory
      ? { actorName: null, actorEmail: null }
      : await getActor(db, req.userId, req.employerId);
    const result = await db.query(
      `INSERT INTO jobs (
        employer_id, title, description, requirements, responsibilities,
        skills_required, location, department, work_type, remote_policy,
        salary_min, salary_max, salary_currency, experience_level,
        education_required, status, application_deadline, positions_available,
        updated_by_name, updated_by_email, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, NOW(), NOW())
      RETURNING *`,
      [
        req.employerId,
        title,
        description,
        requirements,
        responsibilities,
        skills_required || [],
        location,
        department,
        work_type || 'full-time',
        remote_policy || 'on-site',
        salary_min,
        salary_max,
        salary_currency || 'USD',
        experience_level,
        education_required,
        status || 'draft',
        application_deadline,
        positions_available || 1,
        actor.actorName,
        actor.actorEmail,
      ]
    );
    
    const createdJob = result.rows[0];

    if (Array.isArray(prescreening_settings) && prescreening_settings.length > 0) {
      await saveJobPrescreeningSettings(db, createdJob.id, prescreening_settings);
    } else {
      // Default: enable all predefined questions as optional
      const defaultQuestions = await db.query(
        `SELECT id, sort_order FROM prescreening_questions
         WHERE is_predefined = true
         ORDER BY sort_order ASC`
      );
      const defaultSettings = defaultQuestions.rows.map((q, i) => ({
        question_id: q.id,
        is_enabled: true,
        is_required: false,
        sort_order: i,
      }));
      await saveJobPrescreeningSettings(db, createdJob.id, defaultSettings);
    }

    res.status(201).json(createdJob);
  } catch (error) {
    console.error('Create job error:', error);
    res.status(500).json({ error: 'Failed to create job' });
  }
});

// Update job (authenticated)
router.put('/:id', authMiddleware, checkPermission('jobs', 'edit'), async (req, res) => {
  const db = req.app.locals.db;
  
  try {
    const existingJob = await assertJobAccess(db, req, req.params.id);
    if (!existingJob) {
      return res.status(404).json({ error: 'Job not found or unauthorized' });
    }

    const skipActorHistory = isSuperAdminRequest(req);
    const updates = [];
    const values = [];
    let paramCount = 1;
    const prescreeningSettings = req.body.prescreening_settings;
    
    // Build dynamic update query (allowlisted columns only)
    Object.keys(req.body).forEach(key => {
      if (key === 'prescreening_settings') return;
      if (!JOB_UPDATABLE_FIELDS.has(key)) return;
      if (req.body[key] !== undefined) {
        updates.push(`${key} = $${paramCount}`);
        values.push(req.body[key]);
        paramCount++;
      }
    });
    
    if (updates.length === 0 && !Array.isArray(prescreeningSettings)) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    let result;
    if (updates.length > 0) {
      values.push(req.params.id);

      if (skipActorHistory) {
        result = await db.query(
          `UPDATE jobs SET ${updates.join(', ')}, updated_at = NOW()
           WHERE id = $${paramCount}
           RETURNING *`,
          values
        );
      } else {
        const actor = await getActor(db, req.userId, req.employerId || existingJob.employer_id);
        values.push(actor.actorName, actor.actorEmail);
        result = await db.query(
          `UPDATE jobs SET ${updates.join(', ')}, updated_by_name = $${paramCount + 1}, updated_by_email = $${paramCount + 2}, updated_at = NOW()
           WHERE id = $${paramCount}
           RETURNING *`,
          values
        );
      }
    } else {
      result = await db.query('SELECT * FROM jobs WHERE id = $1', [req.params.id]);
    }
    
    if (Array.isArray(prescreeningSettings)) {
      await saveJobPrescreeningSettings(db, req.params.id, prescreeningSettings);
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update job error:', error);
    res.status(500).json({ error: 'Failed to update job' });
  }
});

// Update job position openings (authenticated)
router.patch('/:id/positions', authMiddleware, checkPermission('jobs', 'edit'), async (req, res) => {
  const db = req.app.locals.db;
  const { positions_available, reopen } = req.body;

  try {
    const existingJob = await assertJobAccess(db, req, req.params.id);
    if (!existingJob) {
      return res.status(404).json({ error: 'Job not found or unauthorized' });
    }

    const checkResult = await db.query(
      'SELECT id, positions_available, positions_filled, status FROM jobs WHERE id = $1',
      [req.params.id]
    );

    const actor = isSuperAdminRequest(req)
      ? { actorName: null, actorEmail: null }
      : await getActor(db, req.userId, req.employerId || existingJob.employer_id);
    const current = checkResult.rows[0];
    const nextAvailable = Math.max(
      Number(positions_available ?? current.positions_available) || 1,
      1
    );

    await syncJobPositions(db, req.params.id);

    const filledResult = await db.query(
      `SELECT COUNT(*)::int AS count
       FROM applications
       WHERE job_id = $1 AND LOWER(status) = 'hired'`,
      [req.params.id]
    );
    const positionsFilled = filledResult.rows[0]?.count || 0;

    if (nextAvailable < positionsFilled) {
      return res.status(400).json({
        error: `Total openings cannot be less than hired count (${positionsFilled}).`,
      });
    }

    let nextStatus = current.status;
    const remaining = nextAvailable - positionsFilled;
    if (remaining > 0 && nextStatus === 'closed') {
      nextStatus = 'active';
    }

    const result = await db.query(
      isSuperAdminRequest(req)
        ? `UPDATE jobs
           SET positions_available = $1,
               positions_filled = $2,
               status = $3,
               updated_at = NOW()
           WHERE id = $4
           RETURNING *`
        : `UPDATE jobs
           SET positions_available = $1,
               positions_filled = $2,
               status = $3,
               updated_by_name = $4,
               updated_by_email = $5,
               updated_at = NOW()
           WHERE id = $6
           RETURNING *`,
      isSuperAdminRequest(req)
        ? [nextAvailable, positionsFilled, nextStatus, req.params.id]
        : [nextAvailable, positionsFilled, nextStatus, actor.actorName, actor.actorEmail, req.params.id]
    );

    const job = result.rows[0];
    res.json({
      ...job,
      remaining: Math.max(0, nextAvailable - positionsFilled),
      is_full: remaining === 0,
    });
  } catch (error) {
    console.error('Update job positions error:', error);
    res.status(500).json({ error: 'Failed to update job openings' });
  }
});

// Delete job (authenticated)
router.delete('/:id', authMiddleware, checkPermission('jobs', 'delete'), async (req, res) => {
  const db = req.app.locals.db;
  
  try {
    const existingJob = await assertJobAccess(db, req, req.params.id);
    if (!existingJob) {
      return res.status(404).json({ error: 'Job not found or unauthorized' });
    }

    const result = await db.query(
      'DELETE FROM jobs WHERE id = $1 RETURNING id',
      [req.params.id]
    );
    
    res.json({ success: true, message: 'Job deleted successfully' });
  } catch (error) {
    console.error('Delete job error:', error);
    res.status(500).json({ error: 'Failed to delete job' });
  }
});

// Get applications for a job (authenticated)
router.get('/:id/applications', authMiddleware, checkPermission('applications', 'read'), async (req, res) => {
  const db = req.app.locals.db;
  
  try {
    const existingJob = await assertJobAccess(db, req, req.params.id);
    if (!existingJob) {
      return res.status(404).json({ error: 'Job not found or unauthorized' });
    }
    
    const result = await db.query(
      `SELECT a.*, c.first_name, c.last_name, c.email, c.phone, c.resume_url,
              c.skills, c.experience_years, c.location as candidate_location,
              rs.overall_score, rs.recommendation
       FROM applications a
       LEFT JOIN candidates c ON a.candidate_id = c.id
       LEFT JOIN resume_scores rs ON a.id = rs.application_id
       WHERE a.job_id = $1
       ORDER BY a.application_date DESC`,
      [req.params.id]
    );
    
    res.json(result.rows);
  } catch (error) {
    console.error('Get job applications error:', error);
    res.status(500).json({ error: 'Failed to fetch applications' });
  }
});

module.exports = router;
