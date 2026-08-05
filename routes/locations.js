const express = require('express');
const authMiddleware = require('../middleware/auth');
const { checkPermission } = require('../middleware/permissions');

const router = express.Router();

function normalizeLocationName(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

router.get(
  '/',
  authMiddleware,
  checkPermission('jobs', 'read'),
  async (req, res) => {
    const db = req.app.locals.db;

    try {
      if (!req.employerId) {
        return res.status(400).json({ error: 'Company context required' });
      }

      const result = await db.query(
        `SELECT id, name, created_at, updated_at
         FROM job_locations
         WHERE employer_id = $1
         ORDER BY lower(name) ASC`,
        [req.employerId]
      );

      res.json({ locations: result.rows });
    } catch (error) {
      console.error('List job locations error:', error);
      res.status(500).json({ error: 'Failed to load locations' });
    }
  }
);

router.post(
  '/',
  authMiddleware,
  checkPermission('jobs', 'write'),
  async (req, res) => {
    const db = req.app.locals.db;
    const name = normalizeLocationName(req.body?.name);

    if (!name) {
      return res.status(400).json({ error: 'Location name is required' });
    }

    if (!req.employerId) {
      return res.status(400).json({ error: 'Company context required' });
    }

    try {
      const existing = await db.query(
        `SELECT id, name FROM job_locations
         WHERE employer_id = $1 AND lower(btrim(name)) = lower($2)
         LIMIT 1`,
        [req.employerId, name]
      );

      if (existing.rows.length > 0) {
        return res.status(409).json({
          error: 'This location already exists',
          location: existing.rows[0],
        });
      }

      const result = await db.query(
        `INSERT INTO job_locations (employer_id, name, created_at, updated_at)
         VALUES ($1, $2, NOW(), NOW())
         RETURNING id, name, created_at, updated_at`,
        [req.employerId, name]
      );

      res.status(201).json({ location: result.rows[0] });
    } catch (error) {
      if (error.code === '23505') {
        return res.status(409).json({ error: 'This location already exists' });
      }
      console.error('Create job location error:', error);
      res.status(500).json({ error: 'Failed to create location' });
    }
  }
);

module.exports = router;
