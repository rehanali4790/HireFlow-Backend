const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const { checkPermission } = require('../middleware/permissions');

function requireSuperAdmin(req, res) {
  if (!req.isSuperAdmin) {
    res.status(403).json({ error: 'Super admin access required' });
    return false;
  }
  return true;
}

function slugifyCompanyName(name) {
  const base = String(name || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return base || 'company';
}

async function ensureUniqueSlug(db, baseSlug, excludeId = null) {
  let slug = baseSlug;
  for (let i = 0; i < 20; i += 1) {
    const check = await db.query(
      `SELECT id FROM employers
       WHERE lower(external_api_slug) = lower($1)
         AND ($2::uuid IS NULL OR id <> $2)
       LIMIT 1`,
      [slug, excludeId]
    );
    if (check.rows.length === 0) return slug;
    slug = `${baseSlug}-${crypto.randomBytes(2).toString('hex')}`;
  }
  return `${baseSlug}-${Date.now().toString(36)}`;
}

function mapExternalApiPublic(row) {
  return {
    id: row.id,
    company_name: row.company_name,
    contact_email: row.contact_email,
    created_at: row.created_at,
    user_count: row.user_count,
    company_logo_url: row.company_logo_url || null,
    external_api_enabled: !!row.external_api_enabled,
    external_api_slug: row.external_api_slug || null,
    external_api_username: row.external_api_username || null,
    external_api_configured: !!(row.external_api_username && row.external_api_password_hash),
    external_api_key_prefix: row.external_api_key_prefix || null,
    external_api_updated_at: row.external_api_updated_at || null,
  };
}

// List all companies (super admin)
router.get('/', authMiddleware, async (req, res) => {
  const db = req.app.locals.db;

  if (!requireSuperAdmin(req, res)) return;

  try {
    // Include SA-provisioned tenant shells (*@hireflow.internal).
    // Only hide the internal platform-templates placeholder company.
    const result = await db.query(
      `SELECT e.id, e.company_name, e.contact_email, e.created_at, e.company_logo_url,
              e.external_api_enabled, e.external_api_slug, e.external_api_username,
              e.external_api_password_hash, e.external_api_key_prefix, e.external_api_updated_at,
              (SELECT COUNT(*)::int FROM users u WHERE u.employer_id = e.id) AS user_count
       FROM employers e
       WHERE e.company_name <> '__HireFlow Platform Templates__'
       ORDER BY e.company_name ASC`
    );
    res.json(result.rows.map(mapExternalApiPublic));
  } catch (error) {
    console.error('List employers error:', error);
    res.status(500).json({ error: 'Failed to list companies' });
  }
});

// --- Super Admin: per-organization external API (must be before /:userId) ---

router.get('/:employerId/external-api', authMiddleware, async (req, res) => {
  const db = req.app.locals.db;
  if (!requireSuperAdmin(req, res)) return;

  try {
    const result = await db.query(
      `SELECT id, company_name, contact_email, created_at, company_logo_url,
              external_api_enabled, external_api_slug, external_api_username,
              external_api_password_hash, external_api_key_prefix, external_api_updated_at,
              (SELECT COUNT(*)::int FROM users u WHERE u.employer_id = employers.id) AS user_count
       FROM employers
       WHERE id = $1 AND company_name <> '__HireFlow Platform Templates__'`,
      [req.params.employerId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    res.json(mapExternalApiPublic(result.rows[0]));
  } catch (error) {
    console.error('Get external API config error:', error);
    res.status(500).json({ error: 'Failed to fetch external API config' });
  }
});

router.put('/:employerId/external-api', authMiddleware, async (req, res) => {
  const db = req.app.locals.db;
  if (!requireSuperAdmin(req, res)) return;

  const { external_api_enabled, external_api_slug } = req.body || {};

  try {
    const existing = await db.query(
      `SELECT id, company_name, external_api_slug, external_api_username, external_api_password_hash
       FROM employers
       WHERE id = $1 AND company_name <> '__HireFlow Platform Templates__'`,
      [req.params.employerId]
    );
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    const row = existing.rows[0];
    let nextSlug = row.external_api_slug;

    if (external_api_slug !== undefined) {
      const cleaned = slugifyCompanyName(external_api_slug || row.company_name);
      nextSlug = await ensureUniqueSlug(db, cleaned, row.id);
    }

    if (external_api_enabled === true && !(row.external_api_username && row.external_api_password_hash)) {
      return res.status(400).json({
        error: 'Generate API credentials before enabling external API access',
      });
    }

    const result = await db.query(
      `UPDATE employers
       SET external_api_enabled = COALESCE($1, external_api_enabled),
           external_api_slug = COALESCE($2, external_api_slug),
           external_api_updated_at = NOW(),
           updated_at = NOW()
       WHERE id = $3
       RETURNING id, company_name, contact_email, created_at, company_logo_url,
                 external_api_enabled, external_api_slug, external_api_username,
                 external_api_password_hash, external_api_key_prefix, external_api_updated_at,
                 (SELECT COUNT(*)::int FROM users u WHERE u.employer_id = employers.id) AS user_count`,
      [
        typeof external_api_enabled === 'boolean' ? external_api_enabled : null,
        nextSlug,
        req.params.employerId,
      ]
    );

    res.json(mapExternalApiPublic(result.rows[0]));
  } catch (error) {
    console.error('Update external API config error:', error);
    if (error.code === '23505') {
      return res.status(409).json({ error: 'API slug or username already in use' });
    }
    res.status(500).json({ error: 'Failed to update external API config' });
  }
});

router.post('/:employerId/external-api/generate', authMiddleware, async (req, res) => {
  const db = req.app.locals.db;
  if (!requireSuperAdmin(req, res)) return;

  try {
    const existing = await db.query(
      `SELECT id, company_name, external_api_slug
       FROM employers
       WHERE id = $1 AND company_name <> '__HireFlow Platform Templates__'`,
      [req.params.employerId]
    );
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    const employer = existing.rows[0];
    const slug = await ensureUniqueSlug(
      db,
      employer.external_api_slug || slugifyCompanyName(employer.company_name),
      employer.id
    );

    const username = `hf_${slug}`.slice(0, 64);
    const password = crypto.randomBytes(18).toString('base64url');
    const passwordHash = await bcrypt.hash(password, 10);
    const keyPrefix = password.slice(0, 6);

    // Ensure username unique if slug collision edge-case
    const userConflict = await db.query(
      `SELECT id FROM employers
       WHERE lower(external_api_username) = lower($1) AND id <> $2
       LIMIT 1`,
      [username, employer.id]
    );
    const finalUsername = userConflict.rows.length
      ? `hf_${slug}_${crypto.randomBytes(2).toString('hex')}`
      : username;

    const result = await db.query(
      `UPDATE employers
       SET external_api_slug = $1,
           external_api_username = $2,
           external_api_password_hash = $3,
           external_api_key_prefix = $4,
           external_api_enabled = true,
           external_api_updated_at = NOW(),
           updated_at = NOW()
       WHERE id = $5
       RETURNING id, company_name, contact_email, created_at, company_logo_url,
                 external_api_enabled, external_api_slug, external_api_username,
                 external_api_password_hash, external_api_key_prefix, external_api_updated_at,
                 (SELECT COUNT(*)::int FROM users u WHERE u.employer_id = employers.id) AS user_count`,
      [slug, finalUsername, passwordHash, keyPrefix, employer.id]
    );

    res.json({
      ...mapExternalApiPublic(result.rows[0]),
      // Shown once — client must copy now
      external_api_password: password,
      endpoint: '/api/external/jobs',
      auth_type: 'basic',
    });
  } catch (error) {
    console.error('Generate external API credentials error:', error);
    if (error.code === '23505') {
      return res.status(409).json({ error: 'API slug or username already in use' });
    }
    res.status(500).json({ error: 'Failed to generate external API credentials' });
  }
});

router.post('/:employerId/external-api/revoke', authMiddleware, async (req, res) => {
  const db = req.app.locals.db;
  if (!requireSuperAdmin(req, res)) return;

  try {
    const result = await db.query(
      `UPDATE employers
       SET external_api_enabled = false,
           external_api_username = NULL,
           external_api_password_hash = NULL,
           external_api_key_prefix = NULL,
           external_api_updated_at = NOW(),
           updated_at = NOW()
       WHERE id = $1
         AND company_name <> '__HireFlow Platform Templates__'
       RETURNING id, company_name, contact_email, created_at, company_logo_url,
                 external_api_enabled, external_api_slug, external_api_username,
                 external_api_password_hash, external_api_key_prefix, external_api_updated_at,
                 (SELECT COUNT(*)::int FROM users u WHERE u.employer_id = employers.id) AS user_count`,
      [req.params.employerId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    res.json(mapExternalApiPublic(result.rows[0]));
  } catch (error) {
    console.error('Revoke external API credentials error:', error);
    res.status(500).json({ error: 'Failed to revoke external API credentials' });
  }
});

// Get employer profile (authenticated)
// Works for both employers (owners) and team members
router.get('/:userId', authMiddleware, checkPermission('settings', 'read'), async (req, res) => {
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
router.put('/:userId', authMiddleware, checkPermission('settings', 'edit'), async (req, res) => {
  const db = req.app.locals.db;
  const {
    company_name,
    company_description,
    company_logo_url,
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
           company_logo_url = COALESCE($3, company_logo_url),
           contact_email = COALESCE($4, contact_email),
           contact_phone = COALESCE($5, contact_phone),
           industry = COALESCE($6, industry),
           company_size = COALESCE($7, company_size),
           website = COALESCE($8, website),
           settings = COALESCE($9, settings),
           updated_at = NOW()
       WHERE id = $10
       RETURNING id, company_name, company_description, company_logo_url,
                 contact_email, contact_phone, industry, company_size, website,
                 settings, created_at, updated_at`,
      [
        company_name,
        company_description,
        company_logo_url,
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
