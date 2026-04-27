const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const authMiddleware = require('../middleware/auth');
const pdf = require('pdf-parse');
const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/resumes/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'resume-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
    }
  }
});

// Analyze single resume with AI (authenticated)
router.post('/analyze-resume', authMiddleware, upload.single('resume'), async (req, res) => {
  const db = req.app.locals.db;
  const { jobId } = req.body;
  
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No resume file provided' });
    }

    // Get job details
    const jobResult = await db.query(
      `SELECT * FROM jobs WHERE id = $1 AND employer_id = $2`,
      [jobId, req.employerId]
    );

    if (jobResult.rows.length === 0) {
      return res.status(404).json({ error: 'Job not found' });
    }

    const job = jobResult.rows[0];

    // Extract text from PDF
    const dataBuffer = fs.readFileSync(req.file.path);
    const pdfData = await pdf(dataBuffer);
    const resumeText = pdfData.text;

    console.log('📄 Extracted resume text:', resumeText.substring(0, 200) + '...');

    // Extract candidate info using AI
    const aiService = require('../services/ai-service');
    const OpenAI = require('openai');
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // Extract basic info
    const extractionPrompt = `Extract the following information from this resume:

Resume Text:
${resumeText}

Extract and return ONLY valid JSON:
{
  "name": "Full name",
  "email": "Email address",
  "phone": "Phone number",
  "skills": ["skill1", "skill2", ...],
  "experience_years": number
}

If any field is not found, use reasonable defaults:
- name: "Unknown"
- email: "noemail@example.com"
- phone: ""
- skills: []
- experience_years: 0`;

    const extractionResponse = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are an expert at extracting information from resumes. Return only valid JSON.' },
        { role: 'user', content: extractionPrompt }
      ],
      temperature: 0.1,
      response_format: { type: 'json_object' }
    });

    const candidateInfo = JSON.parse(extractionResponse.choices[0].message.content);
    console.log('👤 Extracted candidate info:', candidateInfo);

    // Analyze resume against job requirements
    const analysis = await aiService.analyzeResume(
      {
        skills: candidateInfo.skills || [],
        experience_years: candidateInfo.experience_years || 0,
        resume_text: resumeText,
        education: [],
        certifications: []
      },
      {
        title: job.title,
        description: job.description,
        skills_required: job.skills_required || [],
        experience_level: job.experience_level
      }
    );

    console.log('✅ Resume analyzed:', {
      name: candidateInfo.name,
      score: analysis.overall_score
    });

    // Return analysis
    res.json({
      success: true,
      data: {
        name: candidateInfo.name,
        email: candidateInfo.email,
        phone: candidateInfo.phone,
        skills: candidateInfo.skills,
        experience_years: candidateInfo.experience_years,
        overall_score: analysis.overall_score,
        skills_match_score: analysis.skills_match_score,
        experience_score: analysis.experience_score,
        education_score: analysis.education_score,
        ai_summary: analysis.ai_summary,
        recommendation: analysis.recommendation,
        resume_url: `/uploads/resumes/${req.file.filename}`,
        resume_text: resumeText
      }
    });

  } catch (error) {
    console.error('❌ Analyze resume error:', error);
    
    // Clean up uploaded file on error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({ error: 'Failed to analyze resume', message: error.message });
  }
});

// Submit application from bulk upload (authenticated)
router.post('/submit-application', authMiddleware, upload.single('resume'), async (req, res) => {
  const db = req.app.locals.db;
  const { jobId, firstName, lastName, email, phone, skills, experienceYears } = req.body;
  
  try {
    // Parse skills if it's a string
    const skillsArray = typeof skills === 'string' ? JSON.parse(skills) : skills;

    // Check if candidate exists
    let candidateId;
    const existingCandidate = await db.query(
      'SELECT id FROM candidates WHERE email = $1',
      [email]
    );

    if (existingCandidate.rows.length > 0) {
      candidateId = existingCandidate.rows[0].id;
      console.log('♻️  Using existing candidate:', email);
    } else {
      // Create new candidate
      const candidateResult = await db.query(
        `INSERT INTO candidates (
          email, first_name, last_name, phone,
          resume_url, skills, experience_years, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
        RETURNING id`,
        [
          email,
          firstName,
          lastName,
          phone || null,
          req.file ? `/uploads/resumes/${req.file.filename}` : null,
          skillsArray || [],
          parseInt(experienceYears) || 0
        ]
      );

      candidateId = candidateResult.rows[0].id;
      console.log('✅ Created new candidate:', email);
    }

    // Check if already applied
    const existingApplication = await db.query(
      'SELECT id FROM applications WHERE job_id = $1 AND candidate_id = $2',
      [jobId, candidateId]
    );

    if (existingApplication.rows.length > 0) {
      return res.status(400).json({ error: 'Candidate has already applied to this job' });
    }

    // Create application
    const applicationResult = await db.query(
      `INSERT INTO applications (
        job_id, candidate_id, status, current_stage,
        application_date, created_at, updated_at
      ) VALUES ($1, $2, 'applied', 'application_received', NOW(), NOW(), NOW())
      RETURNING id`,
      [jobId, candidateId]
    );

    console.log('✅ Application created:', applicationResult.rows[0].id);

    res.json({
      success: true,
      application_id: applicationResult.rows[0].id,
      candidate_id: candidateId
    });

  } catch (error) {
    console.error('❌ Submit application error:', error);
    res.status(500).json({ error: 'Failed to submit application', message: error.message });
  }
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
