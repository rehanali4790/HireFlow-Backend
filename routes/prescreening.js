const express = require('express');
const authMiddleware = require('../middleware/auth');
const { checkPermission } = require('../middleware/permissions');
const { getActor } = require('../middleware/audit-log');
const { isPlatformWide } = require('../utils/platform-scope');
const router = express.Router();

async function assertJobAccess(db, req, jobId) {
  if (isPlatformWide(req)) {
    const result = await db.query('SELECT id, employer_id FROM jobs WHERE id = $1', [jobId]);
    return result.rows[0] || null;
  }

  if (!req.employerId) {
    return null;
  }

  const result = await db.query(
    'SELECT id, employer_id FROM jobs WHERE id = $1 AND employer_id = $2',
    [jobId, req.employerId]
  );
  return result.rows[0] || null;
}

async function getQuestionsForEmployer(db, employerId) {
  const result = await db.query(
    `SELECT *
     FROM prescreening_questions
     WHERE is_predefined = true OR employer_id = $1
     ORDER BY is_predefined DESC, sort_order ASC, created_at ASC`,
    [employerId]
  );
  return result.rows;
}

async function getJobPrescreeningSettings(db, jobId) {
  const result = await db.query(
    `SELECT jps.*, pq.question_text, pq.question_type, pq.options, pq.is_predefined, pq.employer_id
     FROM job_prescreening_settings jps
     JOIN prescreening_questions pq ON pq.id = jps.question_id
     WHERE jps.job_id = $1
     ORDER BY jps.sort_order ASC, pq.sort_order ASC`,
    [jobId]
  );
  return result.rows;
}

async function getDefaultPrescreeningSettings(db) {
  const predefined = await db.query(
    `SELECT id, question_text, question_type, options, is_predefined, sort_order
     FROM prescreening_questions
     WHERE is_predefined = true
     ORDER BY sort_order ASC`
  );
  return predefined.rows.map((q, i) => ({
    question_id: q.id,
    question_text: q.question_text,
    question_type: q.question_type,
    options: q.options,
    is_predefined: q.is_predefined,
    is_enabled: true,
    is_required: false,
    sort_order: i,
  }));
}

async function getEnabledPrescreeningForJob(db, jobId) {
  let settings = await getJobPrescreeningSettings(db, jobId);
  if (settings.length === 0) {
    settings = await getDefaultPrescreeningSettings(db);
  }
  return settings.filter((s) => s.is_enabled);
}

async function saveJobPrescreeningSettings(db, jobId, settings) {
  await db.query('DELETE FROM job_prescreening_settings WHERE job_id = $1', [jobId]);

  if (!Array.isArray(settings) || settings.length === 0) return;

  for (let i = 0; i < settings.length; i++) {
    const item = settings[i];
    await db.query(
      `INSERT INTO job_prescreening_settings (job_id, question_id, is_enabled, is_required, sort_order)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        jobId,
        item.question_id,
        item.is_enabled !== false,
        item.is_required !== false,
        item.sort_order ?? i,
      ]
    );
  }
}

// Get all prescreening questions for employer (predefined + custom)
router.get('/', authMiddleware, checkPermission('jobs', 'read'), async (req, res) => {
  const db = req.app.locals.db;

  try {
    if (!req.employerId) {
      return res.status(400).json({ error: 'Company context required' });
    }

    const questions = await getQuestionsForEmployer(db, req.employerId);
    res.json({ questions });
  } catch (error) {
    console.error('Get prescreening questions error:', error);
    res.status(500).json({ error: 'Failed to fetch prescreening questions' });
  }
});

// Add custom prescreening question (org-level)
router.post('/', authMiddleware, checkPermission('jobs', 'write'), async (req, res) => {
  const db = req.app.locals.db;
  const { question_text, question_type, options } = req.body;

  if (!question_text || !String(question_text).trim()) {
    return res.status(400).json({ error: 'Question text is required' });
  }

  if (!req.employerId) {
    return res.status(400).json({ error: 'Company context required' });
  }

  try {
    const skipActorHistory = Boolean(req.isSuperAdmin || req.userType === 'super_admin');
    const actor = skipActorHistory
      ? { actorName: null, actorEmail: null }
      : await getActor(db, req.userId, req.employerId);
    const countResult = await db.query(
      `SELECT COUNT(*)::int AS count FROM prescreening_questions
       WHERE employer_id = $1 OR is_predefined = true`,
      [req.employerId]
    );
    const sortOrder = countResult.rows[0]?.count || 0;

    const result = await db.query(
      `INSERT INTO prescreening_questions (
        employer_id, question_text, question_type, options, is_predefined,
        sort_order, created_by_name, created_by_email, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, false, $5, $6, $7, NOW(), NOW())
      RETURNING *`,
      [
        req.employerId,
        String(question_text).trim(),
        question_type || 'text',
        JSON.stringify(options || []),
        sortOrder + 1,
        actor.actorName,
        actor.actorEmail,
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create prescreening question error:', error);
    res.status(500).json({ error: 'Failed to create prescreening question' });
  }
});

// Delete custom question (only org-owned, not predefined)
router.delete('/:id', authMiddleware, checkPermission('jobs', 'delete'), async (req, res) => {
  const db = req.app.locals.db;

  try {
    const result = await db.query(
      `DELETE FROM prescreening_questions
       WHERE id = $1 AND employer_id = $2 AND is_predefined = false
       RETURNING id`,
      [req.params.id, req.employerId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Question not found or cannot be deleted' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Delete prescreening question error:', error);
    res.status(500).json({ error: 'Failed to delete prescreening question' });
  }
});

// Get prescreening settings for a job
router.get('/job/:jobId', authMiddleware, checkPermission('jobs', 'read'), async (req, res) => {
  const db = req.app.locals.db;

  try {
    const job = await assertJobAccess(db, req, req.params.jobId);
    if (!job) {
      return res.status(404).json({ error: 'Job not found or unauthorized' });
    }

    const employerId = req.employerId || job.employer_id;
    const [questions, settings] = await Promise.all([
      getQuestionsForEmployer(db, employerId),
      getJobPrescreeningSettings(db, req.params.jobId),
    ]);

    res.json({ questions, settings });
  } catch (error) {
    console.error('Get job prescreening settings error:', error);
    res.status(500).json({ error: 'Failed to fetch job prescreening settings' });
  }
});

// Save prescreening settings for a job
router.put('/job/:jobId', authMiddleware, checkPermission('jobs', 'edit'), async (req, res) => {
  const db = req.app.locals.db;
  const { settings } = req.body;

  try {
    const job = await assertJobAccess(db, req, req.params.jobId);
    if (!job) {
      return res.status(404).json({ error: 'Job not found or unauthorized' });
    }

    await saveJobPrescreeningSettings(db, req.params.jobId, settings || []);
    const saved = await getJobPrescreeningSettings(db, req.params.jobId);
    res.json({ settings: saved });
  } catch (error) {
    console.error('Save job prescreening settings error:', error);
    res.status(500).json({ error: 'Failed to save job prescreening settings' });
  }
});

module.exports = {
  router,
  getQuestionsForEmployer,
  getJobPrescreeningSettings,
  getDefaultPrescreeningSettings,
  getEnabledPrescreeningForJob,
  saveJobPrescreeningSettings,
};
