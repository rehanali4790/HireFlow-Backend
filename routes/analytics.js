const express = require('express');
const authMiddleware = require('../middleware/auth');
const router = express.Router();

// Get dashboard analytics (authenticated)
router.get('/dashboard', authMiddleware, async (req, res) => {
  const db = req.app.locals.db;
  
  try {
    // Total jobs
    const jobsResult = await db.query(
      'SELECT COUNT(*) as total, status FROM jobs WHERE employer_id = $1 GROUP BY status',
      [req.employerId]
    );
    
    const jobStats = {
      total: 0,
      active: 0,
      draft: 0,
      paused: 0,
      closed: 0,
    };
    
    jobsResult.rows.forEach(row => {
      jobStats.total += parseInt(row.count);
      jobStats[row.status] = parseInt(row.count);
    });
    
    // Total applications
    const applicationsResult = await db.query(
      `SELECT COUNT(*) as count, a.status
       FROM applications a
       LEFT JOIN jobs j ON a.job_id = j.id
       WHERE j.employer_id = $1
       GROUP BY a.status`,
      [req.employerId]
    );
    
    const applicationStats = {
      total: 0,
      applied: 0,
      screening: 0,
      shortlisted: 0,
      testing: 0,
      ai_interview: 0,
      final_interview: 0,
      hired: 0,
      rejected: 0,
    };
    
    applicationsResult.rows.forEach(row => {
      applicationStats.total += parseInt(row.count);
      if (row.status.includes('rejected')) {
        applicationStats.rejected += parseInt(row.count);
      } else {
        applicationStats[row.status] = parseInt(row.count);
      }
    });
    
    // Total candidates
    const candidatesResult = await db.query(
      `SELECT COUNT(DISTINCT c.id) as count
       FROM candidates c
       INNER JOIN applications a ON c.id = a.candidate_id
       INNER JOIN jobs j ON a.job_id = j.id
       WHERE j.employer_id = $1`,
      [req.employerId]
    );
    
    const candidateCount = parseInt(candidatesResult.rows[0].count);
    
    // Recent applications
    const recentApplicationsResult = await db.query(
      `SELECT a.*, c.first_name, c.last_name, c.email,
              j.title as job_title
       FROM applications a
       LEFT JOIN candidates c ON a.candidate_id = c.id
       LEFT JOIN jobs j ON a.job_id = j.id
       WHERE j.employer_id = $1
       ORDER BY a.application_date DESC
       LIMIT 10`,
      [req.employerId]
    );
    
    // Pending approvals
    const pendingApprovalsResult = await db.query(
      `SELECT COUNT(*) as count
       FROM applications a
       LEFT JOIN jobs j ON a.job_id = j.id
       WHERE j.employer_id = $1
       AND a.status IN ('screening', 'test_completed', 'ai_interview_completed')`,
      [req.employerId]
    );
    
    const pendingApprovals = parseInt(pendingApprovalsResult.rows[0].count);
    
    // Application trends (last 30 days)
    const trendsResult = await db.query(
      `SELECT DATE(a.application_date) as date, COUNT(*) as count
       FROM applications a
       LEFT JOIN jobs j ON a.job_id = j.id
       WHERE j.employer_id = $1
       AND a.application_date >= NOW() - INTERVAL '30 days'
       GROUP BY DATE(a.application_date)
       ORDER BY date DESC`,
      [req.employerId]
    );
    
    res.json({
      jobs: jobStats,
      applications: applicationStats,
      candidates: candidateCount,
      pendingApprovals,
      recentApplications: recentApplicationsResult.rows,
      applicationTrends: trendsResult.rows,
    });
  } catch (error) {
    console.error('Get analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// Get job-specific analytics (authenticated)
router.get('/jobs/:jobId', authMiddleware, async (req, res) => {
  const db = req.app.locals.db;
  
  try {
    // Verify job belongs to employer
    const jobCheck = await db.query(
      'SELECT * FROM jobs WHERE id = $1 AND employer_id = $2',
      [req.params.jobId, req.employerId]
    );
    
    if (jobCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Job not found' });
    }
    
    const job = jobCheck.rows[0];
    
    // Application stats
    const statsResult = await db.query(
      `SELECT status, COUNT(*) as count
       FROM applications
       WHERE job_id = $1
       GROUP BY status`,
      [req.params.jobId]
    );
    
    // Average scores
    const scoresResult = await db.query(
      `SELECT AVG(rs.overall_score) as avg_score
       FROM resume_scores rs
       LEFT JOIN applications a ON rs.application_id = a.id
       WHERE a.job_id = $1`,
      [req.params.jobId]
    );
    
    res.json({
      job,
      applicationStats: statsResult.rows,
      averageScore: scoresResult.rows[0].avg_score || 0,
    });
  } catch (error) {
    console.error('Get job analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch job analytics' });
  }
});

module.exports = router;
