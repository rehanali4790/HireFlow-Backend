const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');

// Get employer profile (authenticated)
// Works for both employers (owners) and team members
router.get('/:userId', authMiddleware, async (req, res) => {
  const db = req.app.locals.db;

  try {
    // Use employerId from auth middleware (works for both owners and team members)
    const result = await db.query(
      `SELECT id, company_name, company_description, company_logo_url,
              contact_email, contact_phone, industry, company_size, website,
              settings, created_at, updated_at
       FROM employers WHERE id = $1`,
      [req.employerId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Employer profile not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get employer error:', error);
    res.status(500).json({ error: 'Failed to fetch employer profile' });
  }
});

// Update employer profile (authenticated, owner/admin only)
router.put('/:userId', authMiddleware, async (req, res) => {
  const db = req.app.locals.db;
  const {
    company_name,
    company_description,
    contact_email,
    contact_phone,
    industry,
    company_size,
    website,
    settings
  } = req.body;

  try {
    // Check if user is owner (employer)
    const isOwner = req.userId === req.employerId;
    
    // Check if user is admin (team member with admin rights)
    let isAdmin = false;
    if (!isOwner) {
      const userCheck = await db.query(
        'SELECT is_admin FROM users WHERE id = $1 AND employer_id = $2',
        [req.userId, req.employerId]
      );
      isAdmin = userCheck.rows.length > 0 && userCheck.rows[0].is_admin;
    }

    // Only owners and admins can update company settings
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: 'Only owners and admins can update company settings' });
    }

    // Check if employer exists
    const existing = await db.query(
      'SELECT id FROM employers WHERE id = $1',
      [req.employerId]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Employer profile not found' });
    }

    // Update employer profile
    const result = await db.query(
      `UPDATE employers
       SET company_name = COALESCE($1, company_name),
           company_description = COALESCE($2, company_description),
           contact_email = COALESCE($3, contact_email),
           contact_phone = COALESCE($4, contact_phone),
           industry = COALESCE($5, industry),
           company_size = COALESCE($6, company_size),
           website = COALESCE($7, website),
           settings = COALESCE($8, settings),
           updated_at = NOW()
       WHERE id = $9
       RETURNING id, company_name, company_description, company_logo_url,
                 contact_email, contact_phone, industry, company_size, website,
                 settings, created_at, updated_at`,
      [
        company_name,
        company_description,
        contact_email,
        contact_phone,
        industry,
        company_size,
        website,
        settings ? JSON.stringify(settings) : null,
        req.employerId
      ]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update employer error:', error);
    res.status(500).json({ error: 'Failed to update employer profile' });
  }
});

module.exports = router;
