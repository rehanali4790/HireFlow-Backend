const express = require('express');
const authMiddleware = require('../middleware/auth');
const { checkPermission, hasPermissionValue } = require('../middleware/permissions');
const { getActor } = require('../middleware/audit-log');

const router = express.Router();

const VALID_STATUSES = ['pending', 'accepted', 'rejected', 'on_hold'];

/** Employer/owner accounts use employers.id as userId — not in users table, so FK cols must be null. */
function resolveUsersFkId(req) {
  return req.userId && req.userId !== req.employerId ? req.userId : null;
}

async function userCanReview(req) {
  if (req.userId === req.employerId) return true;
  return hasPermissionValue(req, 'requisitions', 'edit');
}

async function logRequisitionEvent(db, {
  requisitionId,
  employerId,
  action,
  message = null,
  fromStatus = null,
  toStatus = null,
  actorUserId = null,
  actorName = null,
  actorEmail = null,
  metadata = {},
}) {
  await db.query(
    `INSERT INTO requisition_events (
      requisition_id, employer_id, action, message,
      from_status, to_status, actor_user_id, actor_name, actor_email, metadata, created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, NOW())`,
    [
      requisitionId,
      employerId,
      action,
      message,
      fromStatus,
      toStatus,
      actorUserId,
      actorName,
      actorEmail,
      JSON.stringify(metadata || {}),
    ]
  );
}

function mapRequisitionRow(row) {
  return {
    id: row.id,
    job_title: row.job_title,
    department: row.department,
    positions_count: row.positions_count,
    location: row.location,
    work_type: row.work_type,
    justification: row.justification,
    skills_required: row.skills_required,
    budget_min: row.budget_min != null ? Number(row.budget_min) : null,
    budget_max: row.budget_max != null ? Number(row.budget_max) : null,
    urgency: row.urgency,
    additional_notes: row.additional_notes,
    status: row.status,
    hr_message: row.hr_message,
    submitted_by_user_id: row.submitted_by_user_id,
    submitted_by_name: row.submitted_by_name,
    submitted_by_email: row.submitted_by_email,
    decided_by_name: row.decided_by_name,
    decided_by_email: row.decided_by_email,
    decided_at: row.decided_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

router.get(
  '/',
  authMiddleware,
  checkPermission('requisitions', 'read'),
  async (req, res) => {
    const db = req.app.locals.db;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 15));
    const offset = (page - 1) * limit;
    const q = String(req.query.q || '').trim();
    const status = String(req.query.status || 'all').toLowerCase();
    const scope = String(req.query.scope || 'mine').toLowerCase();

    try {
      const canReview = await userCanReview(req);
      const params = [req.employerId];
      const where = ['r.employer_id = $1'];

      if (scope === 'review') {
        if (!canReview) {
          return res.status(403).json({ error: 'You do not have permission to review requisitions' });
        }
      } else {
        const submitterFk = resolveUsersFkId(req);
        if (submitterFk) {
          params.push(submitterFk);
          where.push(`r.submitted_by_user_id = $${params.length}`);
        } else {
          // Owner submissions store null submitted_by_user_id
          where.push('r.submitted_by_user_id IS NULL');
        }
      }

      if (status !== 'all' && VALID_STATUSES.includes(status)) {
        params.push(status);
        where.push(`lower(r.status) = $${params.length}`);
      }

      if (q) {
        params.push(`%${q.toLowerCase()}%`);
        const idx = params.length;
        where.push(`(
          lower(r.job_title) LIKE $${idx}
          OR lower(COALESCE(r.department, '')) LIKE $${idx}
          OR lower(COALESCE(r.location, '')) LIKE $${idx}
          OR lower(COALESCE(r.submitted_by_name, '')) LIKE $${idx}
          OR lower(COALESCE(r.submitted_by_email, '')) LIKE $${idx}
        )`);
      }

      const whereClause = where.join(' AND ');

      const countResult = await db.query(
        `SELECT COUNT(*)::int AS total FROM job_requisitions r WHERE ${whereClause}`,
        params
      );
      const total = countResult.rows[0]?.total || 0;

      const listParams = [...params, limit, offset];
      const result = await db.query(
        `SELECT r.*
         FROM job_requisitions r
         WHERE ${whereClause}
         ORDER BY r.created_at DESC
         LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`,
        listParams
      );

      res.json({
        items: result.rows.map(mapRequisitionRow),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.max(1, Math.ceil(total / limit)),
        },
        can_review: canReview,
      });
    } catch (error) {
      console.error('List requisitions error:', error);
      res.status(500).json({ error: 'Failed to load requisitions' });
    }
  }
);

router.post(
  '/',
  authMiddleware,
  checkPermission('requisitions', 'write'),
  async (req, res) => {
    const db = req.app.locals.db;
    const {
      jobTitle,
      department,
      positionsCount,
      location,
      workType,
      justification,
      skillsRequired,
      budgetMin,
      budgetMax,
      urgency,
      additionalNotes,
    } = req.body || {};

    const title = String(jobTitle || '').trim();
    if (!title) {
      return res.status(400).json({ error: 'Job title is required' });
    }

    const positions = Math.max(1, parseInt(positionsCount, 10) || 1);
    const actor = await getActor(db, req.userId, req.employerId);
    const submitterUserId = resolveUsersFkId(req);

    try {
      const insertResult = await db.query(
        `INSERT INTO job_requisitions (
          employer_id, submitted_by_user_id, submitted_by_name, submitted_by_email,
          job_title, department, positions_count, location, work_type,
          justification, skills_required, budget_min, budget_max, urgency,
          additional_notes, status, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4,
          $5, $6, $7, $8, $9,
          $10, $11, $12, $13, $14,
          $15, 'pending', NOW(), NOW()
        )
        RETURNING *`,
        [
          req.employerId,
          submitterUserId,
          actor.actorName,
          actor.actorEmail,
          title,
          department ? String(department).trim() : null,
          positions,
          location ? String(location).trim() : null,
          workType ? String(workType).trim() : null,
          justification ? String(justification).trim() : null,
          skillsRequired ? String(skillsRequired).trim() : null,
          budgetMin != null && budgetMin !== '' ? Number(budgetMin) : null,
          budgetMax != null && budgetMax !== '' ? Number(budgetMax) : null,
          urgency ? String(urgency).trim() : 'medium',
          additionalNotes ? String(additionalNotes).trim() : null,
        ]
      );

      const row = insertResult.rows[0];

      await logRequisitionEvent(db, {
        requisitionId: row.id,
        employerId: req.employerId,
        action: 'submitted',
        message: null,
        fromStatus: null,
        toStatus: 'pending',
        actorUserId: submitterUserId,
        actorName: actor.actorName,
        actorEmail: actor.actorEmail,
        metadata: { job_title: title },
      });

      res.status(201).json({ requisition: mapRequisitionRow(row) });
    } catch (error) {
      console.error('Create requisition error:', error);
      res.status(500).json({ error: 'Failed to submit requisition' });
    }
  }
);

router.get(
  '/:id/events',
  authMiddleware,
  checkPermission('requisitions', 'read'),
  async (req, res) => {
    const db = req.app.locals.db;
    const { id } = req.params;

    try {
      const reqResult = await db.query(
        `SELECT id, employer_id, submitted_by_user_id FROM job_requisitions
         WHERE id = $1 AND employer_id = $2`,
        [id, req.employerId]
      );

      if (reqResult.rows.length === 0) {
        return res.status(404).json({ error: 'Requisition not found' });
      }

      const requisition = reqResult.rows[0];
      const canReview = await userCanReview(req);
      const isOwner = requisition.submitted_by_user_id === req.userId || req.userId === req.employerId;

      if (!canReview && !isOwner) {
        return res.status(403).json({ error: 'You do not have permission to view these logs' });
      }

      const eventsResult = await db.query(
        `SELECT id, action, message, from_status, to_status,
                actor_name, actor_email, metadata, created_at
         FROM requisition_events
         WHERE requisition_id = $1 AND employer_id = $2
         ORDER BY created_at ASC`,
        [id, req.employerId]
      );

      res.json({ events: eventsResult.rows });
    } catch (error) {
      console.error('Requisition events error:', error);
      res.status(500).json({ error: 'Failed to load requisition logs' });
    }
  }
);

router.post(
  '/:id/decide',
  authMiddleware,
  checkPermission('requisitions', 'edit'),
  async (req, res) => {
    const db = req.app.locals.db;
    const { id } = req.params;
    const { action, message } = req.body || {};
    const normalizedAction = String(action || '').trim().toLowerCase();
    const decisionMessage = String(message || '').trim();

    const actionMap = {
      accept: { nextStatus: 'accepted', eventAction: 'accepted', requiresMessage: false },
      reject: { nextStatus: 'rejected', eventAction: 'rejected', requiresMessage: true },
      hold: { nextStatus: 'on_hold', eventAction: 'held', requiresMessage: true },
      accept_hold: { nextStatus: 'accepted', eventAction: 'accept_from_hold', requiresMessage: false },
    };

    const decision = actionMap[normalizedAction];
    if (!decision) {
      return res.status(400).json({ error: 'Invalid action. Use accept, reject, hold, or accept_hold' });
    }

    if (decision.requiresMessage && !decisionMessage) {
      return res.status(400).json({ error: 'Message is required for this action' });
    }

    const canReview = await userCanReview(req);
    if (!canReview) {
      return res.status(403).json({ error: 'You do not have permission to review requisitions' });
    }

    try {
      const reqResult = await db.query(
        `SELECT * FROM job_requisitions WHERE id = $1 AND employer_id = $2`,
        [id, req.employerId]
      );

      if (reqResult.rows.length === 0) {
        return res.status(404).json({ error: 'Requisition not found' });
      }

      const requisition = reqResult.rows[0];
      const currentStatus = String(requisition.status || '').toLowerCase();

      if (normalizedAction === 'accept' && currentStatus !== 'pending') {
        return res.status(400).json({ error: 'Only pending requisitions can be accepted' });
      }
      if (normalizedAction === 'reject' && !['pending', 'on_hold'].includes(currentStatus)) {
        return res.status(400).json({ error: 'Only pending or on-hold requisitions can be rejected' });
      }
      if (normalizedAction === 'hold' && currentStatus !== 'pending') {
        return res.status(400).json({ error: 'Only pending requisitions can be put on hold' });
      }
      if (normalizedAction === 'accept_hold' && currentStatus !== 'on_hold') {
        return res.status(400).json({ error: 'Only on-hold requisitions can be accepted from hold' });
      }

      const actor = await getActor(db, req.userId, req.employerId);
      const decidedByUserId = resolveUsersFkId(req);
      const hrMessage = decision.requiresMessage ? decisionMessage : (requisition.hr_message || null);

      const updateResult = await db.query(
        `UPDATE job_requisitions
         SET status = $1,
             hr_message = $2,
             decided_by_user_id = $3,
             decided_by_name = $4,
             decided_by_email = $5,
             decided_at = NOW(),
             updated_at = NOW()
         WHERE id = $6 AND employer_id = $7
         RETURNING *`,
        [
          decision.nextStatus,
          hrMessage,
          decidedByUserId,
          actor.actorName,
          actor.actorEmail,
          id,
          req.employerId,
        ]
      );

      await logRequisitionEvent(db, {
        requisitionId: id,
        employerId: req.employerId,
        action: decision.eventAction,
        message: decisionMessage || null,
        fromStatus: currentStatus,
        toStatus: decision.nextStatus,
        actorUserId: decidedByUserId,
        actorName: actor.actorName,
        actorEmail: actor.actorEmail,
      });

      res.json({ requisition: mapRequisitionRow(updateResult.rows[0]) });
    } catch (error) {
      console.error('Requisition decide error:', error);
      res.status(500).json({ error: 'Failed to update requisition' });
    }
  }
);

module.exports = router;
