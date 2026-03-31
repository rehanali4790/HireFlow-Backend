const express = require('express');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const authMiddleware = require('../middleware/auth');
const router = express.Router();

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});

// Create bulk upload session (authenticated)
router.post('/session', authMiddleware, async (req, res) => {
  const db = req.app.locals.db;
  const { jobId, totalCandidates } = req.body;
  
  try {
    // Verify job belongs to employer
    const jobCheck = await db.query(
      'SELECT id FROM jobs WHERE id = $1 AND employer_id = $2',
      [jobId, req.employerId]
    );
    
    if (jobCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Job not found' });
    }
    
    const result = await db.query(
      `INSERT INTO bulk_upload_sessions (
        employer_id, job_id, total_candidates, status, created_at, updated_at
      ) VALUES ($1, $2, $3, 'processing', NOW(), NOW())
      RETURNING *`,
      [req.employerId, jobId, totalCandidates]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create bulk upload session error:', error);
    res.status(500).json({ error: 'Failed to create bulk upload session' });
  }
});

// Upload candidates in bulk (authenticated)
router.post('/candidates', authMiddleware, upload.single('file'), async (req, res) => {
  const db = req.app.locals.db;
  const { sessionId, candidates } = req.body;
  
  try {
    // Parse candidates if it's a string
    const candidateList = typeof candidates === 'string' ? JSON.parse(candidates) : candidates;
    
    // Verify session belongs to employer
    const sessionCheck = await db.query(
      'SELECT * FROM bulk_upload_sessions WHERE id = $1 AND employer_id = $2',
      [sessionId, req.employerId]
    );
    
    if (sessionCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Bulk upload session not found' });
    }
    
    const session = sessionCheck.rows[0];
    const results = [];
    
    // Process each candidate
    for (const candidate of candidateList) {
      try {
        // Check if candidate exists
        let candidateId;
        const existingCandidate = await db.query(
          'SELECT id FROM candidates WHERE email = $1',
          [candidate.email]
        );
        
        if (existingCandidate.rows.length > 0) {
          candidateId = existingCandidate.rows[0].id;
        } else {
          // Create new candidate
          const candidateResult = await db.query(
            `INSERT INTO candidates (
              email, first_name, last_name, phone, location,
              resume_url, skills, experience_years, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
            RETURNING id`,
            [
              candidate.email,
              candidate.firstName,
              candidate.lastName,
              candidate.phone,
              candidate.location,
              candidate.resumeUrl,
              candidate.skills || [],
              candidate.experienceYears,
            ]
          );
          
          candidateId = candidateResult.rows[0].id;
        }
        
        // Check if already applied
        const existingApplication = await db.query(
          'SELECT id FROM applications WHERE job_id = $1 AND candidate_id = $2',
          [session.job_id, candidateId]
        );
        
        if (existingApplication.rows.length === 0) {
          // Create application
          await db.query(
            `INSERT INTO applications (
              job_id, candidate_id, status, current_stage,
              application_date, created_at, updated_at
            ) VALUES ($1, $2, 'applied', 'application_received', NOW(), NOW(), NOW())`,
            [session.job_id, candidateId]
          );
          
          results.push({ email: candidate.email, status: 'success' });
        } else {
          results.push({ email: candidate.email, status: 'duplicate' });
        }
      } catch (error) {
        console.error(`Error processing candidate ${candidate.email}:`, error);
        results.push({ email: candidate.email, status: 'error', error: error.message });
      }
    }
    
    // Update session
    const successCount = results.filter(r => r.status === 'success').length;
    await db.query(
      `UPDATE bulk_upload_sessions
       SET processed_candidates = processed_candidates + $1,
           status = CASE WHEN processed_candidates + $1 >= total_candidates THEN 'completed' ELSE 'processing' END,
           updated_at = NOW()
       WHERE id = $2`,
      [successCount, sessionId]
    );
    
    res.json({ success: true, results });
  } catch (error) {
    console.error('Bulk upload candidates error:', error);
    res.status(500).json({ error: 'Failed to upload candidates' });
  }
});

// Get bulk upload session status (authenticated)
router.get('/session/:id', authMiddleware, async (req, res) => {
  const db = req.app.locals.db;
  
  try {
    const result = await db.query(
      `SELECT * FROM bulk_upload_sessions
       WHERE id = $1 AND employer_id = $2`,
      [req.params.id, req.employerId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Bulk upload session not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get bulk upload session error:', error);
    res.status(500).json({ error: 'Failed to fetch bulk upload session' });
  }
});

// Get all bulk upload sessions for employer (authenticated)
router.get('/sessions', authMiddleware, async (req, res) => {
  const db = req.app.locals.db;
  
  try {
    const result = await db.query(
      `SELECT bus.*, j.title as job_title
       FROM bulk_upload_sessions bus
       LEFT JOIN jobs j ON bus.job_id = j.id
       WHERE bus.employer_id = $1
       ORDER BY bus.created_at DESC`,
      [req.employerId]
    );
    
    res.json(result.rows);
  } catch (error) {
    console.error('Get bulk upload sessions error:', error);
    res.status(500).json({ error: 'Failed to fetch bulk upload sessions' });
  }
});

module.exports = router;
