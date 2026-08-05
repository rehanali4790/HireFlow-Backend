const express = require('express');
const authMiddleware = require('../middleware/auth');
const { checkPermission, checkAnyPermission, applicationReadPermissions } = require('../middleware/permissions');
const { isPlatformWide } = require('../utils/platform-scope');
const { syncJobPositions } = require('../utils/job-positions');
const router = express.Router();

// Bundled overview dashboard data (jobs + applications + activity) for Overview page
router.get('/overview-dashboard', authMiddleware, checkAnyPermission(applicationReadPermissions), async (req, res) => {
  const db = req.app.locals.db;
  const platformWide = isPlatformWide(req);

  if (!platformWide && !req.employerId) {
    return res.status(400).json({ error: 'Company context required' });
  }

  try {
    const jobsResult = platformWide
      ? await db.query(`
          SELECT j.*, e.company_name, e.company_logo_url
          FROM jobs j
          LEFT JOIN employers e ON j.employer_id = e.id
          ORDER BY j.created_at DESC
        `)
      : await db.query(`
          SELECT j.*, e.company_name, e.company_logo_url
          FROM jobs j
          LEFT JOIN employers e ON j.employer_id = e.id
          WHERE j.employer_id = $1
          ORDER BY j.created_at DESC
        `, [req.employerId]);

    const syncedJobs = [];
    for (const job of jobsResult.rows) {
      const positions = await syncJobPositions(db, job.id);
      syncedJobs.push({
        ...job,
        positions_available: positions?.positions_available ?? job.positions_available,
        positions_filled: positions?.positions_filled ?? job.positions_filled,
        status: positions?.status ?? job.status,
      });
    }

    const applicationsResult = platformWide
      ? await db.query(`
          SELECT a.*,
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
          ORDER BY a.application_date DESC
        `)
      : await db.query(`
          SELECT a.*,
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
          ORDER BY a.application_date DESC
        `, [req.employerId]);

    const activityParams = [];
    const activityWhere = [];
    if (!platformWide) {
      activityParams.push(req.employerId);
      activityWhere.push(`employer_id = $${activityParams.length}`);
    }
    activityParams.push(500);
    const activityWhereClause = activityWhere.length > 0 ? `WHERE ${activityWhere.join(' AND ')}` : '';

    const activityResult = await db.query(
      `SELECT id, user_id, employer_id, actor_name, actor_email, action,
              resource_type, resource_id, details, request_method,
              request_path, status_code, created_at
       FROM user_activity_log
       ${activityWhereClause}
       ORDER BY created_at DESC
       LIMIT $${activityParams.length}`,
      activityParams
    );

    res.json({
      jobs: syncedJobs,
      applications: applicationsResult.rows,
      activityLogs: activityResult.rows,
    });
  } catch (error) {
    console.error('Get overview dashboard error:', error);
    res.status(500).json({ error: 'Failed to fetch overview dashboard' });
  }
});

// Get dashboard analytics (authenticated)
router.get('/dashboard', authMiddleware, checkPermission('analytics', 'read'), async (req, res) => {
  const db = req.app.locals.db;
  
  try {
    const platformWide = isPlatformWide(req);
    if (!platformWide && !req.employerId) {
      return res.status(400).json({ error: 'Company context required' });
    }

    const jobsResult = platformWide
      ? await db.query('SELECT COUNT(*) as total, status FROM jobs GROUP BY status')
      : await db.query(
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
    const applicationsResult = platformWide
      ? await db.query(
          `SELECT COUNT(*) as count, a.status
           FROM applications a
           LEFT JOIN jobs j ON a.job_id = j.id
           GROUP BY a.status`
        )
      : await db.query(
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
    const candidatesResult = platformWide
      ? await db.query(
          `SELECT COUNT(DISTINCT c.id) as count
           FROM candidates c
           INNER JOIN applications a ON c.id = a.candidate_id
           INNER JOIN jobs j ON a.job_id = j.id`
        )
      : await db.query(
          `SELECT COUNT(DISTINCT c.id) as count
           FROM candidates c
           INNER JOIN applications a ON c.id = a.candidate_id
           INNER JOIN jobs j ON a.job_id = j.id
           WHERE j.employer_id = $1`,
          [req.employerId]
        );
    
    const candidateCount = parseInt(candidatesResult.rows[0].count);
    
    // Recent applications
    const recentApplicationsResult = platformWide
      ? await db.query(
          `SELECT a.*, c.first_name, c.last_name, c.email,
                  j.title as job_title
           FROM applications a
           LEFT JOIN candidates c ON a.candidate_id = c.id
           LEFT JOIN jobs j ON a.job_id = j.id
           ORDER BY a.application_date DESC
           LIMIT 10`
        )
      : await db.query(
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
    const pendingApprovalsResult = platformWide
      ? await db.query(
          `SELECT COUNT(*) as count
           FROM applications a
           LEFT JOIN jobs j ON a.job_id = j.id
           WHERE a.status IN ('screening', 'test_completed', 'ai_interview_completed')`
        )
      : await db.query(
          `SELECT COUNT(*) as count
           FROM applications a
           LEFT JOIN jobs j ON a.job_id = j.id
           WHERE j.employer_id = $1
           AND a.status IN ('screening', 'test_completed', 'ai_interview_completed')`,
          [req.employerId]
        );
    
    const pendingApprovals = parseInt(pendingApprovalsResult.rows[0].count);
    
    // Application trends (last 30 days)
    const trendsResult = platformWide
      ? await db.query(
          `SELECT DATE(a.application_date) as date, COUNT(*) as count
           FROM applications a
           LEFT JOIN jobs j ON a.job_id = j.id
           WHERE a.application_date >= NOW() - INTERVAL '30 days'
           GROUP BY DATE(a.application_date)
           ORDER BY date DESC`
        )
      : await db.query(
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
router.get('/jobs/:jobId', authMiddleware, checkPermission('analytics', 'read'), async (req, res) => {
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
