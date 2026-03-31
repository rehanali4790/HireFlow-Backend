const express = require('express');
const authMiddleware = require('../middleware/auth');
const router = express.Router();

// Get all candidates (authenticated - only those who applied to employer's jobs)
router.get('/', authMiddleware, async (req, res) => {
  const db = req.app.locals.db;
  
  try {
    const result = await db.query(
      `SELECT DISTINCT c.*,
              COUNT(a.id) as application_count,
              MAX(a.application_date) as last_application_date
       FROM candidates c
       INNER JOIN applications a ON c.id = a.candidate_id
       INNER JOIN jobs j ON a.job_id = j.id
       WHERE j.employer_id = $1
       GROUP BY c.id
       ORDER BY last_application_date DESC`,
      [req.employerId]
    );
    
    res.json(result.rows);
  } catch (error) {
    console.error('Get candidates error:', error);
    res.status(500).json({ error: 'Failed to fetch candidates' });
  }
});

// Get single candidate (authenticated)
router.get('/:id', authMiddleware, async (req, res) => {
  const db = req.app.locals.db;
  
  try {
    // Get candidate with their applications to employer's jobs
    const candidateResult = await db.query(
      `SELECT c.* FROM candidates c
       INNER JOIN applications a ON c.id = a.candidate_id
       INNER JOIN jobs j ON a.job_id = j.id
       WHERE c.id = $1 AND j.employer_id = $2
       LIMIT 1`,
      [req.params.id, req.employerId]
    );
    
    if (candidateResult.rows.length === 0) {
      return res.status(404).json({ error: 'Candidate not found' });
    }
    
    const candidate = candidateResult.rows[0];
    
    // Get all applications from this candidate to employer's jobs
    const applicationsResult = await db.query(
      `SELECT a.*, j.title as job_title, j.location as job_location,
              rs.overall_score, rs.recommendation
       FROM applications a
       LEFT JOIN jobs j ON a.job_id = j.id
       LEFT JOIN resume_scores rs ON a.id = rs.application_id
       WHERE a.candidate_id = $1 AND j.employer_id = $2
       ORDER BY a.application_date DESC`,
      [req.params.id, req.employerId]
    );
    
    candidate.applications = applicationsResult.rows;
    
    res.json(candidate);
  } catch (error) {
    console.error('Get candidate error:', error);
    res.status(500).json({ error: 'Failed to fetch candidate' });
  }
});

module.exports = router;
