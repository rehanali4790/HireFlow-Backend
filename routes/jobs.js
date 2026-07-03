const express = require('express');
const authMiddleware = require('../middleware/auth');
const { checkPermission } = require('../middleware/permissions');
const { getActor } = require('../middleware/audit-log');
const { generateJobContent } = require('../services/ai-service');
const { syncJobPositions } = require('../utils/job-positions');
const router = express.Router();

// Get all jobs (public - only active, authenticated - all own jobs)
router.get('/', async (req, res) => {
  const db = req.app.locals.db;
  const employerId = req.headers['x-employer-id'];
  
  try {
    let query;
    let params = [];
    
    if (employerId) {
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

    if (employerId) {
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
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get job error:', error);
    res.status(500).json({ error: 'Failed to fetch job' });
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
  } = req.body;
  
  try {
    const actor = await getActor(db, req.userId, req.employerId);
    const result = await db.query(
      `INSERT INTO jobs (
        employer_id, title, description, requirements, responsibilities,
        skills_required, location, work_type, remote_policy,
        salary_min, salary_max, salary_currency, experience_level,
        education_required, status, application_deadline, positions_available,
        updated_by_name, updated_by_email, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, NOW(), NOW())
      RETURNING *`,
      [
        req.employerId,
        title,
        description,
        requirements,
        responsibilities,
        skills_required || [],
        location,
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
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create job error:', error);
    res.status(500).json({ error: 'Failed to create job' });
  }
});

// Update job (authenticated)
router.put('/:id', authMiddleware, checkPermission('jobs', 'edit'), async (req, res) => {
  const db = req.app.locals.db;
  
  try {
    const actor = await getActor(db, req.userId, req.employerId);
    // Check if job belongs to employer
    const checkResult = await db.query(
      'SELECT id FROM jobs WHERE id = $1 AND employer_id = $2',
      [req.params.id, req.employerId]
    );
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Job not found or unauthorized' });
    }
    
    const updates = [];
    const values = [];
    let paramCount = 1;
    
    // Build dynamic update query
    Object.keys(req.body).forEach(key => {
      if (req.body[key] !== undefined) {
        updates.push(`${key} = $${paramCount}`);
        values.push(req.body[key]);
        paramCount++;
      }
    });
    
    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }
    
    values.push(req.params.id);
    
    values.push(actor.actorName, actor.actorEmail);

    const result = await db.query(
      `UPDATE jobs SET ${updates.join(', ')}, updated_by_name = $${paramCount + 1}, updated_by_email = $${paramCount + 2}, updated_at = NOW()
       WHERE id = $${paramCount}
       RETURNING *`,
      values
    );
    
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
    const checkResult = await db.query(
      'SELECT id, positions_available, positions_filled, status FROM jobs WHERE id = $1 AND employer_id = $2',
      [req.params.id, req.employerId]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Job not found or unauthorized' });
    }

    const actor = await getActor(db, req.userId, req.employerId);
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
      `UPDATE jobs
       SET positions_available = $1,
           positions_filled = $2,
           status = $3,
           updated_by_name = $4,
           updated_by_email = $5,
           updated_at = NOW()
       WHERE id = $6
       RETURNING *`,
      [nextAvailable, positionsFilled, nextStatus, actor.actorName, actor.actorEmail, req.params.id]
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
    const result = await db.query(
      'DELETE FROM jobs WHERE id = $1 AND employer_id = $2 RETURNING id',
      [req.params.id, req.employerId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Job not found or unauthorized' });
    }
    
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
    // Check if job belongs to employer
    const checkResult = await db.query(
      'SELECT id FROM jobs WHERE id = $1 AND employer_id = $2',
      [req.params.id, req.employerId]
    );
    
    if (checkResult.rows.length === 0) {
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
