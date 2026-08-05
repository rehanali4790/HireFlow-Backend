const express = require('express');
const authMiddleware = require('../middleware/auth');
const { checkAnyPermission, applicationReadPermissions } = require('../middleware/permissions');
const { isPlatformWide } = require('../utils/platform-scope');

const router = express.Router();
const NOTIFICATION_RESOURCE_TYPES = ['candidate_notifications', 'requisition_notifications'];

// Get tenant notification feed (authenticated)
router.get('/notifications', authMiddleware, async (req, res) => {
  const db = req.app.locals.db;
  const { limit = 20 } = req.query;

  try {
    const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
    const result = await db.query(
      `SELECT id, actor_name, actor_email, action, resource_type, resource_id,
              details, created_at
       FROM user_activity_log
       WHERE employer_id = $1
         AND resource_type = ANY($2::text[])
       ORDER BY created_at DESC
       LIMIT $3`,
      [req.employerId, NOTIFICATION_RESOURCE_TYPES, safeLimit]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// Dismiss a single tenant notification (authenticated)
router.delete('/notifications/:id', authMiddleware, async (req, res) => {
  const db = req.app.locals.db;

  try {
    const result = await db.query(
      `DELETE FROM user_activity_log
       WHERE id = $1
         AND employer_id = $2
         AND resource_type = ANY($3::text[])
       RETURNING id`,
      [req.params.id, req.employerId, NOTIFICATION_RESOURCE_TYPES]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Dismiss notification error:', error);
    res.status(500).json({ error: 'Failed to dismiss notification' });
  }
});

// Get tenant activity logs (authenticated)
router.get('/', authMiddleware, checkAnyPermission([
  { resource: 'settings', action: 'read' },
  { resource: 'users', action: 'read' },
  { resource: 'overview', action: 'read' },
  ...applicationReadPermissions,
]), async (req, res) => {
  const db = req.app.locals.db;
  const {
    resource_type,
    action,
    search,
    limit = 100,
  } = req.query;

  try {
    const platformWide = isPlatformWide(req);
    if (!req.employerId && !platformWide) {
      return res.status(400).json({ error: 'Company context required' });
    }

    const params = [];
    const where = [];

    if (!platformWide) {
      params.push(req.employerId);
      where.push(`employer_id = $${params.length}`);
    }

    if (resource_type) {
      params.push(resource_type);
      where.push(`resource_type = $${params.length}`);
    }

    if (action) {
      params.push(action);
      where.push(`action = $${params.length}`);
    }

    if (search) {
      params.push(`%${search}%`);
      where.push(`(actor_name ILIKE $${params.length} OR actor_email ILIKE $${params.length} OR resource_type ILIKE $${params.length})`);
    }

    const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 100, 1), 500);
    params.push(safeLimit);

    const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

    const result = await db.query(
      `SELECT id, user_id, employer_id, actor_name, actor_email, action,
              resource_type, resource_id, details, request_method,
              request_path, status_code, created_at
       FROM user_activity_log
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${params.length}`,
      params
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Get activity logs error:', error);
    res.status(500).json({ error: 'Failed to fetch activity logs' });
  }
});

module.exports = router;
