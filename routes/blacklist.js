const express = require('express');
const authMiddleware = require('../middleware/auth');
const { checkPermission } = require('../middleware/permissions');
const { getActor } = require('../middleware/audit-log');
const { logPipelineEvent } = require('../utils/pipeline-events');

const router = express.Router();

const ACTIVE_PIPELINE_STATUSES = [
  'new', 'applied', 'screening', 'reviewing',
  'screening_pending', 'not_attempted_call',
  'shortlisted', 'offer_extended',
  'testing', 'test_completed',
  'ai_interview', 'ai_interview_completed',
  'hod_interview',
  'interviewing', 'final_interview', 'not_attended',
  'undecided', 'on_hold',
];

async function logBlacklistEvent(db, {
  employerId,
  candidateId = null,
  applicationId = null,
  action,
  reason = null,
  actorName = null,
  actorEmail = null,
  metadata = {},
}) {
  await db.query(
    `INSERT INTO blacklist_events (
      employer_id, candidate_id, application_id, action, reason,
      actor_name, actor_email, metadata, created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, NOW())`,
    [
      employerId,
      candidateId,
      applicationId,
      action,
      reason,
      actorName,
      actorEmail,
      JSON.stringify(metadata || {}),
    ]
  );
}

async function findActiveBlacklist(db, employerId, { candidateId, email, phone }) {
  const params = [employerId];
  const identity = [];

  if (candidateId) {
    params.push(candidateId);
    identity.push(`b.candidate_id = $${params.length}`);
  }

  if (email) {
    params.push(String(email).trim().toLowerCase());
    identity.push(`lower(b.email) = $${params.length}`);
  }

  if (phone) {
    const normalizedPhone = String(phone).replace(/\D/g, '');
    if (normalizedPhone.length >= 7) {
      params.push(normalizedPhone);
      identity.push(`regexp_replace(COALESCE(b.phone, ''), '\\D', '', 'g') = $${params.length}`);
    }
  }

  if (identity.length === 0) return null;

  const result = await db.query(
    `SELECT b.*
     FROM candidate_blacklist b
     WHERE b.employer_id = $1
       AND b.removed_at IS NULL
       AND (${identity.join(' OR ')})
     ORDER BY b.blacklisted_at DESC
     LIMIT 1`,
    params
  );
  return result.rows[0] || null;
}

// Resume archive: all applications for employer (paginated + search + status filter)
router.get(
  '/archive',
  authMiddleware,
  checkPermission('candidates', 'read'),
  async (req, res) => {
    const db = req.app.locals.db;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 15));
    const offset = (page - 1) * limit;
    const q = String(req.query.q || '').trim();
    const status = String(req.query.status || 'all').toLowerCase();
    const includeBlacklisted = String(req.query.include_blacklisted || 'true') === 'true';

    try {
      const params = [req.employerId];
      const where = ['j.employer_id = $1'];

      if (!includeBlacklisted) {
        where.push(`lower(COALESCE(a.status, '')) <> 'blacklisted'`);
        where.push(`NOT EXISTS (
          SELECT 1 FROM candidate_blacklist b
          WHERE b.employer_id = $1
            AND b.candidate_id = c.id
            AND b.removed_at IS NULL
        )`);
      }

      if (status === 'old') {
        where.push(`a.application_date < NOW() - INTERVAL '90 days'`);
      } else if (status === 'new') {
        where.push(`lower(a.status) IN ('new', 'applied', 'screening')`);
      } else if (status === 'shortlisted') {
        where.push(`lower(a.status) IN ('shortlisted', 'offer_extended')`);
      } else if (status === 'approved' || status === 'reviewing') {
        where.push(`lower(a.status) IN ('reviewing', 'screening_pending', 'not_attempted_call')`);
      } else if (status === 'rejected') {
        where.push(`(
          lower(a.status) LIKE 'rejected%'
          OR lower(a.status) IN ('test_cancelled', 'ai_interview_cancelled')
        )`);
      } else if (status === 'hired') {
        where.push(`lower(a.status) = 'hired'`);
      } else if (status === 'blacklisted') {
        where.push(`(
          lower(a.status) = 'blacklisted'
          OR EXISTS (
            SELECT 1 FROM candidate_blacklist b
            WHERE b.employer_id = $1 AND b.candidate_id = c.id AND b.removed_at IS NULL
          )
        )`);
      } else if (status !== 'all') {
        where.push(`lower(a.status) = $${params.length + 1}`);
        params.push(status);
      }

      if (q) {
        params.push(`%${q.toLowerCase()}%`);
        const idx = params.length;
        where.push(`(
          lower(COALESCE(c.first_name, '') || ' ' || COALESCE(c.last_name, '')) LIKE $${idx}
          OR lower(COALESCE(c.email, '')) LIKE $${idx}
          OR lower(COALESCE(c.phone, '')) LIKE $${idx}
          OR lower(COALESCE(c.linkedin_url, '')) LIKE $${idx}
          OR lower(COALESCE(j.title, '')) LIKE $${idx}
        )`);
      }

      const whereSql = where.join(' AND ');

      const countResult = await db.query(
        `SELECT COUNT(*)::int AS total
         FROM applications a
         JOIN candidates c ON c.id = a.candidate_id
         JOIN jobs j ON j.id = a.job_id
         WHERE ${whereSql}`,
        params
      );

      const listParams = [...params, limit, offset];
      const listResult = await db.query(
        `SELECT
           a.id AS application_id,
           a.status,
           a.application_date,
           a.updated_at,
           c.id AS candidate_id,
           c.first_name,
           c.last_name,
           c.email,
           c.phone,
           c.linkedin_url,
           c.resume_url,
           c.picture_url,
           j.id AS job_id,
           j.title AS job_title,
           rs.overall_score,
           CASE WHEN b.id IS NOT NULL THEN true ELSE false END AS is_blacklisted,
           b.id AS blacklist_id,
           b.reason AS blacklist_reason,
           b.blacklisted_at,
           b.blacklisted_by_name
         FROM applications a
         JOIN candidates c ON c.id = a.candidate_id
         JOIN jobs j ON j.id = a.job_id
         LEFT JOIN resume_scores rs ON rs.application_id = a.id
         LEFT JOIN candidate_blacklist b
           ON b.candidate_id = c.id
          AND b.employer_id = j.employer_id
          AND b.removed_at IS NULL
         WHERE ${whereSql}
         ORDER BY a.application_date DESC
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        listParams
      );

      const total = countResult.rows[0]?.total || 0;
      res.json({
        items: listResult.rows,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.max(1, Math.ceil(total / limit)),
        },
      });
    } catch (error) {
      console.error('Resume archive error:', error);
      res.status(500).json({ error: 'Failed to load resume archive' });
    }
  }
);

// Active blacklisted candidates
router.get(
  '/',
  authMiddleware,
  checkPermission('candidates', 'read'),
  async (req, res) => {
    const db = req.app.locals.db;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 15));
    const offset = (page - 1) * limit;
    const q = String(req.query.q || '').trim();

    try {
      const params = [req.employerId];
      const where = ['b.employer_id = $1', 'b.removed_at IS NULL'];

      if (q) {
        params.push(`%${q.toLowerCase()}%`);
        const idx = params.length;
        where.push(`(
          lower(COALESCE(c.first_name, '') || ' ' || COALESCE(c.last_name, '')) LIKE $${idx}
          OR lower(COALESCE(c.email, '')) LIKE $${idx}
          OR lower(COALESCE(c.phone, '')) LIKE $${idx}
          OR lower(COALESCE(c.linkedin_url, '')) LIKE $${idx}
          OR lower(COALESCE(b.reason, '')) LIKE $${idx}
        )`);
      }

      const whereSql = where.join(' AND ');

      const countResult = await db.query(
        `SELECT COUNT(*)::int AS total
         FROM candidate_blacklist b
         JOIN candidates c ON c.id = b.candidate_id
         WHERE ${whereSql}`,
        params
      );

      const listParams = [...params, limit, offset];
      const listResult = await db.query(
        `SELECT
           b.id AS blacklist_id,
           b.reason,
           b.blacklisted_at,
           b.blacklisted_by_name,
           b.blacklisted_by_email,
           b.email AS blacklisted_email,
           b.phone AS blacklisted_phone,
           c.id AS candidate_id,
           c.first_name,
           c.last_name,
           c.email,
           c.phone,
           c.linkedin_url,
           c.resume_url,
           (
             SELECT COALESCE(json_agg(app_row ORDER BY app_row.application_date DESC), '[]'::json)
             FROM (
               SELECT
                 a.id AS application_id,
                 a.status,
                 a.application_date,
                 j.title AS job_title,
                 j.id AS job_id
               FROM applications a
               JOIN jobs j ON j.id = a.job_id
               WHERE a.candidate_id = c.id
                 AND j.employer_id = b.employer_id
               ORDER BY a.application_date DESC
               LIMIT 8
             ) app_row
           ) AS applications
         FROM candidate_blacklist b
         JOIN candidates c ON c.id = b.candidate_id
         WHERE ${whereSql}
         ORDER BY b.blacklisted_at DESC
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        listParams
      );

      const total = countResult.rows[0]?.total || 0;
      res.json({
        items: listResult.rows,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.max(1, Math.ceil(total / limit)),
        },
      });
    } catch (error) {
      console.error('List blacklist error:', error);
      res.status(500).json({ error: 'Failed to load blacklisted candidates' });
    }
  }
);

// Blacklist event logs for a candidate
router.get(
  '/events/:candidateId',
  authMiddleware,
  checkPermission('candidates', 'read'),
  async (req, res) => {
    const db = req.app.locals.db;
    try {
      const result = await db.query(
        `SELECT *
         FROM blacklist_events
         WHERE employer_id = $1 AND candidate_id = $2
         ORDER BY created_at DESC
         LIMIT 100`,
        [req.employerId, req.params.candidateId]
      );
      res.json({ events: result.rows });
    } catch (error) {
      console.error('Blacklist events error:', error);
      res.status(500).json({ error: 'Failed to load blacklist logs' });
    }
  }
);

// Add to blacklist (reason required)
router.post(
  '/',
  authMiddleware,
  checkPermission('candidates', 'edit'),
  async (req, res) => {
    const db = req.app.locals.db;
    const { candidateId, applicationId, reason } = req.body || {};
    const comment = typeof reason === 'string' ? reason.trim() : '';

    if (!candidateId) {
      return res.status(400).json({ error: 'candidateId is required' });
    }
    if (!comment || comment.length < 3) {
      return res.status(400).json({ error: 'Blacklist comment/reason is required (min 3 characters)' });
    }

    try {
      const candidateResult = await db.query(
        `SELECT c.*
         FROM candidates c
         JOIN applications a ON a.candidate_id = c.id
         JOIN jobs j ON j.id = a.job_id
         WHERE c.id = $1 AND j.employer_id = $2
         LIMIT 1`,
        [candidateId, req.employerId]
      );

      if (candidateResult.rows.length === 0) {
        return res.status(404).json({ error: 'Candidate not found' });
      }

      const candidate = candidateResult.rows[0];
      const existing = await findActiveBlacklist(db, req.employerId, { candidateId });
      if (existing) {
        return res.status(409).json({ error: 'Candidate is already blacklisted', blacklist: existing });
      }

      const actor = await getActor(db, req.userId, req.employerId);

      const blacklistResult = await db.query(
        `INSERT INTO candidate_blacklist (
          employer_id, candidate_id, email, phone, reason,
          blacklisted_by_name, blacklisted_by_email, blacklisted_at, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW(), NOW())
        RETURNING *`,
        [
          req.employerId,
          candidateId,
          candidate.email,
          candidate.phone || null,
          comment,
          actor.actorName,
          actor.actorEmail,
        ]
      );

      const movedApps = await db.query(
        `UPDATE applications a
         SET status_before_blacklist = a.status,
             status = 'blacklisted',
             current_stage = 'blacklisted',
             employer_notes = CASE
               WHEN $3::text IS NULL OR LENGTH(TRIM($3::text)) = 0 THEN employer_notes
               ELSE CONCAT_WS(E'\n', employer_notes, CONCAT('Blacklisted: ', $3::text))
             END,
             updated_at = NOW()
         FROM jobs j
         WHERE a.job_id = j.id
           AND j.employer_id = $1
           AND a.candidate_id = $2
           AND lower(COALESCE(a.status, '')) <> 'hired'
           AND lower(COALESCE(a.status, '')) <> 'blacklisted'
           AND lower(COALESCE(a.status, '')) = ANY($4::text[])
         RETURNING a.id, a.status_before_blacklist`,
        [req.employerId, candidateId, comment, ACTIVE_PIPELINE_STATUSES]
      );

      for (const app of movedApps.rows) {
        await logPipelineEvent(db, {
          applicationId: app.id,
          stage: 'blacklisted',
          action: 'blacklisted',
          fromStatus: app.status_before_blacklist,
          toStatus: 'blacklisted',
          outcome: 'blacklisted',
          notes: comment,
          actorName: actor.actorName,
          actorEmail: actor.actorEmail,
          metadata: { reason: comment },
        });
      }

      await logBlacklistEvent(db, {
        employerId: req.employerId,
        candidateId,
        applicationId: applicationId || movedApps.rows[0]?.id || null,
        action: 'blacklisted',
        reason: comment,
        actorName: actor.actorName,
        actorEmail: actor.actorEmail,
        metadata: {
          moved_application_ids: movedApps.rows.map((r) => r.id),
          moved_count: movedApps.rows.length,
        },
      });

      res.status(201).json({
        blacklist: blacklistResult.rows[0],
        movedApplications: movedApps.rows.length,
        message: 'Candidate blacklisted successfully',
      });
    } catch (error) {
      console.error('Blacklist create error:', error);
      res.status(500).json({ error: 'Failed to blacklist candidate' });
    }
  }
);

// Remove from blacklist → restore to hiring pipeline
router.post(
  '/:blacklistId/remove',
  authMiddleware,
  checkPermission('candidates', 'edit'),
  async (req, res) => {
    const db = req.app.locals.db;
    const removeReason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
    const restoreStatus = (req.body?.restoreStatus || 'reviewing').toLowerCase();
    const allowedRestore = new Set(['new', 'reviewing', 'shortlisted']);
    const nextStatus = allowedRestore.has(restoreStatus) ? restoreStatus : 'reviewing';
    const nextStage = nextStatus === 'shortlisted' ? 'shortlisted' : nextStatus === 'new' ? 'new' : 'reviewing';

    try {
      const existing = await db.query(
        `SELECT b.*, c.first_name, c.last_name, c.email AS candidate_email
         FROM candidate_blacklist b
         JOIN candidates c ON c.id = b.candidate_id
         WHERE b.id = $1 AND b.employer_id = $2`,
        [req.params.blacklistId, req.employerId]
      );

      if (existing.rows.length === 0) {
        return res.status(404).json({ error: 'Blacklist record not found' });
      }

      const row = existing.rows[0];
      if (row.removed_at) {
        return res.status(400).json({ error: 'Candidate is already removed from blacklist' });
      }

      const actor = await getActor(db, req.userId, req.employerId);
      const note = removeReason || `Removed from blacklist by ${actor.actorName}`;

      await db.query(
        `UPDATE candidate_blacklist
         SET removed_at = NOW(),
             removed_by_name = $2,
             removed_by_email = $3,
             remove_reason = $4,
             updated_at = NOW()
         WHERE id = $1`,
        [row.id, actor.actorName, actor.actorEmail, note]
      );

      const restoredApps = await db.query(
        `UPDATE applications a
         SET status = COALESCE(NULLIF(a.status_before_blacklist, ''), $3),
             current_stage = CASE lower(COALESCE(NULLIF(a.status_before_blacklist, ''), $3))
               WHEN 'new' THEN 'new'
               WHEN 'applied' THEN 'new'
               WHEN 'screening' THEN 'new'
               WHEN 'reviewing' THEN 'reviewing'
               WHEN 'screening_pending' THEN 'call'
               WHEN 'not_attempted_call' THEN 'call'
               WHEN 'shortlisted' THEN 'shortlisted'
               WHEN 'offer_extended' THEN 'shortlisted'
               WHEN 'testing' THEN 'test'
               WHEN 'test_completed' THEN 'test'
               WHEN 'ai_interview' THEN 'ai_interview'
               WHEN 'ai_interview_completed' THEN 'ai_interview'
               WHEN 'hod_interview' THEN 'hod_interview'
               WHEN 'interviewing' THEN 'hr_interview'
               WHEN 'final_interview' THEN 'hr_interview'
               WHEN 'not_attended' THEN 'hr_interview'
               WHEN 'undecided' THEN 'on_hold'
               WHEN 'on_hold' THEN 'on_hold'
               ELSE $4
             END,
             status_before_blacklist = NULL,
             updated_at = NOW()
         FROM jobs j
         WHERE a.job_id = j.id
           AND j.employer_id = $1
           AND a.candidate_id = $2
           AND lower(COALESCE(a.status, '')) = 'blacklisted'
         RETURNING a.id, a.status`,
        [req.employerId, row.candidate_id, nextStatus, nextStage]
      );

      // If no blacklisted apps existed (edge), restore latest open app into reviewing
      let restored = restoredApps.rows;
      if (restored.length === 0) {
        const fallback = await db.query(
          `UPDATE applications a
           SET status = $3,
               current_stage = $4,
               updated_at = NOW()
           FROM jobs j
           WHERE a.id = (
             SELECT a2.id
             FROM applications a2
             JOIN jobs j2 ON j2.id = a2.job_id
             WHERE a2.candidate_id = $2
               AND j2.employer_id = $1
               AND lower(COALESCE(a2.status, '')) <> 'hired'
             ORDER BY a2.application_date DESC
             LIMIT 1
           )
           AND a.job_id = j.id
           AND j.employer_id = $1
           RETURNING a.id, a.status`,
          [req.employerId, row.candidate_id, nextStatus, nextStage]
        );
        restored = fallback.rows;
      }

      for (const app of restored) {
        await logPipelineEvent(db, {
          applicationId: app.id,
          stage: nextStage,
          action: 'removed_from_blacklist',
          fromStatus: 'blacklisted',
          toStatus: app.status,
          outcome: app.status,
          notes: note,
          actorName: actor.actorName,
          actorEmail: actor.actorEmail,
          metadata: { remove_reason: note, restored_to: app.status },
        });
      }

      await logBlacklistEvent(db, {
        employerId: req.employerId,
        candidateId: row.candidate_id,
        applicationId: restored[0]?.id || null,
        action: 'removed',
        reason: note,
        actorName: actor.actorName,
        actorEmail: actor.actorEmail,
        metadata: {
          restored_application_ids: restored.map((r) => r.id),
          restored_to: nextStatus,
          candidate_name: `${row.first_name || ''} ${row.last_name || ''}`.trim(),
        },
      });

      res.json({
        message: 'Candidate removed from blacklist and restored to hiring pipeline',
        restoredApplications: restored.length,
        restoreStatus: nextStatus,
      });
    } catch (error) {
      console.error('Remove blacklist error:', error);
      res.status(500).json({ error: 'Failed to remove candidate from blacklist' });
    }
  }
);

module.exports = router;
module.exports.findActiveBlacklist = findActiveBlacklist;
module.exports.logBlacklistEvent = logBlacklistEvent;
