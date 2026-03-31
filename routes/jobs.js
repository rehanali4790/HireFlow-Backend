const express = require('express');
const authMiddleware = require('../middleware/auth');
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

// Create job (authenticated)
router.post('/', authMiddleware, async (req, res) => {
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
    const result = await db.query(
      `INSERT INTO jobs (
        employer_id, title, description, requirements, responsibilities,
        skills_required, location, work_type, remote_policy,
        salary_min, salary_max, salary_currency, experience_level,
        education_required, status, application_deadline, positions_available,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, NOW(), NOW())
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
      ]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create job error:', error);
    res.status(500).json({ error: 'Failed to create job' });
  }
});

// Update job (authenticated)
router.put('/:id', authMiddleware, async (req, res) => {
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
    
    const result = await db.query(
      `UPDATE jobs SET ${updates.join(', ')}, updated_at = NOW()
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

// Delete job (authenticated)
router.delete('/:id', authMiddleware, async (req, res) => {
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
router.get('/:id/applications', authMiddleware, async (req, res) => {
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
