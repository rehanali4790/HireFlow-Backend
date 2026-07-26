const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const authMiddleware = require('../middleware/auth');
const { checkPermission } = require('../middleware/permissions');
const { isPlatformWide } = require('../utils/platform-scope');
const {
  clonePlatformRolesToEmployer,
  mapPlatformRoleToCompanyRole,
} = require('../utils/platform-employer');

async function findOrCreateCompany(db, companyName, companyLogoUrl) {
  const name = String(companyName || '').trim();
  if (!name) {
    throw Object.assign(new Error('Company name is required'), { status: 400 });
  }

  const logoUrl = companyLogoUrl ? String(companyLogoUrl).trim() : null;

  const existing = await db.query(
    `SELECT id, company_name, company_logo_url FROM employers
     WHERE lower(company_name) = lower($1)
       AND company_name <> '__HireFlow Platform Templates__'
     ORDER BY created_at ASC
     LIMIT 1`,
    [name]
  );

  if (existing.rows.length > 0) {
    const employer = existing.rows[0];
    if (logoUrl) {
      const updated = await db.query(
        `UPDATE employers
         SET company_logo_url = $1, updated_at = NOW()
         WHERE id = $2
         RETURNING id, company_name, company_logo_url`,
        [logoUrl, employer.id]
      );
      return { employer: updated.rows[0], created: false };
    }
    return { employer, created: false };
  }

  const internalEmail = `company-${crypto.randomUUID()}@hireflow.internal`;
  const lockedHash = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10);

  const insert = await db.query(
    `INSERT INTO employers (contact_email, password_hash, company_name, company_logo_url, created_at, updated_at)
     VALUES ($1, $2, $3, $4, NOW(), NOW())
     RETURNING id, company_name, company_logo_url`,
    [internalEmail, lockedHash, name, logoUrl]
  );

  return { employer: insert.rows[0], created: true };
}

async function resolveRoleForEmployer(db, employerId, roleId, preferAdmin = false) {
  if (roleId) {
    const roleCheck = await db.query(
      'SELECT id FROM roles WHERE id = $1 AND employer_id = $2',
      [roleId, employerId]
    );
    if (roleCheck.rows.length === 0) {
      throw Object.assign(new Error('Invalid role for this company'), { status: 400 });
    }
    return roleId;
  }

  if (!preferAdmin) return null;

  // Default to Admin role for newly provisioned companies
  const adminRole = await db.query(
    `SELECT id FROM roles
     WHERE employer_id = $1 AND lower(name) = 'admin'
     ORDER BY created_at ASC
     LIMIT 1`,
    [employerId]
  );
  return adminRole.rows[0]?.id || null;
}

// Current logged-in user profile (no password)
router.get('/me', authMiddleware, async (req, res) => {
  const db = req.app.locals.db;

  try {
    if (req.isSuperAdmin) {
      const { getSuperAdminCredentials } = require('../utils/super-admin');
      const creds = getSuperAdminCredentials();
      return res.json({
        id: 'super-admin',
        first_name: 'Super',
        last_name: 'Admin',
        email: creds?.email || null,
        phone: null,
        department: null,
        designation: null,
        company_name: 'HireFlow Platform',
        role_name: 'Super Admin',
        role_description: 'Platform administrator (ENV)',
        is_admin: true,
        is_active: true,
        is_super_admin: true,
        last_login: null,
        created_at: null,
      });
    }

    const profileSelect = `
      SELECT u.id, u.email, u.first_name, u.last_name, u.phone, u.avatar_url,
             u.department, u.designation,
             u.is_active, u.is_admin, u.last_login, u.created_at, u.updated_at,
             u.role_id, r.name as role_name, r.description as role_description,
             u.employer_id, e.company_name, e.company_logo_url
      FROM users u
      JOIN employers e ON e.id = u.employer_id
      LEFT JOIN roles r ON u.role_id = r.id
    `;

    // Prefer team-member row whenever userId maps to users table
    // (do this BEFORE owner check so role/phone/department/designation always load)
    if (req.userId && req.userId !== 'super-admin') {
      const byId = await db.query(
        `${profileSelect} WHERE u.id = $1 LIMIT 1`,
        [req.userId]
      );
      if (byId.rows.length > 0) {
        const row = byId.rows[0];
        // Tenant safety: team member must belong to current employer when set
        if (!req.employerId || row.employer_id === req.employerId || req.userType === 'user') {
          return res.json(row);
        }
      }
    }

    // Employer / company owner account
    if (req.userId && req.userId === req.employerId) {
      // If a team user exists with the same email, prefer that full profile
      const linked = await db.query(
        `${profileSelect}
         WHERE u.employer_id = $1
           AND lower(u.email) = lower((SELECT contact_email FROM employers WHERE id = $1))
         ORDER BY u.is_admin DESC, u.created_at ASC
         LIMIT 1`,
        [req.employerId]
      );
      if (linked.rows.length > 0) {
        return res.json(linked.rows[0]);
      }

      const result = await db.query(
        `SELECT id, company_name, contact_email, contact_phone, industry, company_size,
                website, company_logo_url, created_at, updated_at
         FROM employers WHERE id = $1`,
        [req.employerId]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Profile not found' });
      }
      const e = result.rows[0];
      return res.json({
        id: e.id,
        first_name: e.company_name,
        last_name: '',
        email: e.contact_email,
        phone: e.contact_phone || null,
        department: null,
        designation: 'Owner',
        company_name: e.company_name,
        company_logo_url: e.company_logo_url || null,
        role_name: 'Owner',
        role_description: 'Company owner account',
        is_admin: true,
        is_active: true,
        is_owner: true,
        industry: e.industry || null,
        company_size: e.company_size || null,
        website: e.website || null,
        last_login: null,
        created_at: e.created_at,
      });
    }

    return res.status(404).json({ error: 'Profile not found' });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to load profile' });
  }
});

// User Reporting metrics (team read only — no settings/applications permission required)
router.get('/reporting-data', authMiddleware, checkPermission('users', 'read'), async (req, res) => {
  const db = req.app.locals.db;

  try {
    const safeLimit = Math.min(Math.max(parseInt(req.query.limit, 10) || 500, 1), 500);
    const platformWide = isPlatformWide(req);

    if (!req.employerId && !platformWide) {
      return res.status(400).json({ error: 'Company context required' });
    }

    const [logsResult, appsResult] = platformWide
      ? await Promise.all([
          db.query(
            `SELECT id, user_id, actor_name, actor_email, action,
                    resource_type, resource_id, details, request_path, created_at
             FROM user_activity_log
             ORDER BY created_at DESC
             LIMIT $1`,
            [safeLimit]
          ),
          db.query(
            `SELECT a.id, a.application_date, a.hired_at, a.hire_date, a.status
             FROM applications a
             JOIN jobs j ON a.job_id = j.id`
          ),
        ])
      : await Promise.all([
          db.query(
            `SELECT id, user_id, actor_name, actor_email, action,
                    resource_type, resource_id, details, request_path, created_at
             FROM user_activity_log
             WHERE employer_id = $1
             ORDER BY created_at DESC
             LIMIT $2`,
            [req.employerId, safeLimit]
          ),
          db.query(
            `SELECT a.id, a.application_date, a.hired_at, a.hire_date, a.status
             FROM applications a
             JOIN jobs j ON a.job_id = j.id
             WHERE j.employer_id = $1`,
            [req.employerId]
          ),
        ]);

    res.json({
      logs: logsResult.rows,
      applications: appsResult.rows,
    });
  } catch (error) {
    console.error('Get user reporting data error:', error);
    res.status(500).json({ error: 'Failed to fetch user reporting data' });
  }
});

// Get all users for employer (authenticated)
// Super admin without tenant: all users across companies
router.get('/', authMiddleware, checkPermission('users', 'read'), async (req, res) => {
  const db = req.app.locals.db;

  try {
    if (req.isSuperAdmin && !req.employerId) {
      const result = await db.query(
        `SELECT u.id, u.email, u.first_name, u.last_name, u.phone, u.avatar_url,
                u.department, u.designation,
                u.is_active, u.is_admin, u.last_login, u.created_at, u.updated_at,
                u.role_id, r.name as role_name, r.description as role_description,
                u.employer_id, e.company_name
         FROM users u
         JOIN employers e ON e.id = u.employer_id
         LEFT JOIN roles r ON u.role_id = r.id
         ORDER BY u.created_at DESC`
      );
      return res.json(result.rows);
    }

    if (!req.employerId) {
      return res.status(400).json({ error: 'Company context required' });
    }

    const result = await db.query(
      `SELECT u.id, u.email, u.first_name, u.last_name, u.phone, u.avatar_url,
              u.department, u.designation,
              u.is_active, u.is_admin, u.last_login, u.created_at, u.updated_at,
              u.role_id, r.name as role_name, r.description as role_description,
              u.employer_id, e.company_name
       FROM users u
       JOIN employers e ON e.id = u.employer_id
       LEFT JOIN roles r ON u.role_id = r.id
       WHERE u.employer_id = $1
       ORDER BY u.created_at DESC`,
      [req.employerId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Get single user (authenticated)
router.get('/:id', authMiddleware, checkPermission('users', 'read'), async (req, res) => {
  const db = req.app.locals.db;

  try {
    if (req.isSuperAdmin) {
      const result = await db.query(
        `SELECT u.id, u.email, u.first_name, u.last_name, u.phone, u.avatar_url,
                u.department, u.designation,
                u.is_active, u.is_admin, u.last_login, u.created_at, u.updated_at,
                u.role_id, r.name as role_name, r.description as role_description,
                u.employer_id, e.company_name
         FROM users u
         JOIN employers e ON e.id = u.employer_id
         LEFT JOIN roles r ON u.role_id = r.id
         WHERE u.id = $1`,
        [req.params.id]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }
      return res.json(result.rows[0]);
    }

    const result = await db.query(
      `SELECT u.id, u.email, u.first_name, u.last_name, u.phone, u.avatar_url,
              u.department, u.designation,
              u.is_active, u.is_admin, u.last_login, u.created_at, u.updated_at,
              u.role_id, r.name as role_name, r.description as role_description,
              u.employer_id, e.company_name
       FROM users u
       JOIN employers e ON e.id = u.employer_id
       LEFT JOIN roles r ON u.role_id = r.id
       WHERE u.id = $1 AND u.employer_id = $2`,
      [req.params.id, req.employerId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// Create new user (authenticated)
// Super admin: company_name creates/finds company (replaces public signup)
router.post('/', authMiddleware, checkPermission('users', 'write'), async (req, res) => {
  const db = req.app.locals.db;
  const {
    email,
    first_name,
    last_name,
    password,
    phone,
    department,
    designation,
    role_id,
    is_admin,
    company_name,
    company_logo_url,
  } = req.body;

  try {
    let normalizedRoleId = role_id || null;

    if (!email || !first_name || !last_name || !password) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    let employerId = req.employerId;

    let companyJustCreated = false;
    if (req.isSuperAdmin) {
      const companyName = String(company_name || '').trim();
      if (!companyName && !employerId) {
        return res.status(400).json({ error: 'Company name is required' });
      }

      if (companyName) {
        const { employer, created } = await findOrCreateCompany(db, companyName, company_logo_url);
        employerId = employer.id;
        companyJustCreated = created;
        if (created) {
          await clonePlatformRolesToEmployer(db, employerId);
        }
      }
    }

    if (!employerId) {
      return res.status(400).json({ error: 'Company context required' });
    }

    // Global email uniqueness for users
    const existing = await db.query(
      'SELECT id FROM users WHERE lower(email) = lower($1)',
      [email]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'User with this email already exists' });
    }

    // Also block if email is an active employer login email
    const existingEmployer = await db.query(
      `SELECT id FROM employers
       WHERE lower(contact_email) = lower($1)
         AND contact_email NOT LIKE '%@hireflow.internal'`,
      [email]
    );
    if (existingEmployer.rows.length > 0) {
      return res.status(409).json({ error: 'Email already registered as a company account' });
    }

    if (req.isSuperAdmin && normalizedRoleId) {
      normalizedRoleId = await mapPlatformRoleToCompanyRole(db, normalizedRoleId, employerId);
      if (!normalizedRoleId) {
        return res.status(400).json({ error: 'Selected role could not be assigned to this company' });
      }
    }

    try {
      // Only auto-pick Admin when no role selected AND new company
      if (!normalizedRoleId) {
        normalizedRoleId = await resolveRoleForEmployer(
          db,
          employerId,
          null,
          companyJustCreated
        );
      } else {
        // Verify mapped role is on this company
        normalizedRoleId = await resolveRoleForEmployer(
          db,
          employerId,
          normalizedRoleId,
          false
        );
      }
    } catch (roleErr) {
      return res.status(roleErr.status || 400).json({ error: roleErr.message });
    }

    const password_hash = await bcrypt.hash(password, 10);
    const makeAdmin = req.isSuperAdmin
      ? (companyJustCreated ? true : !!is_admin)
      : (is_admin || false);

    const result = await db.query(
      `INSERT INTO users (
        employer_id, email, first_name, last_name, password_hash,
        phone, department, designation, role_id, is_admin, is_active, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true, NOW(), NOW())
      RETURNING id, email, first_name, last_name, phone, department, designation,
                role_id, is_admin, is_active, created_at, employer_id`,
      [
        employerId,
        email,
        first_name,
        last_name,
        password_hash,
        phone || null,
        department || null,
        designation || null,
        normalizedRoleId,
        makeAdmin,
      ]
    );

    const company = await db.query(
      'SELECT company_name FROM employers WHERE id = $1',
      [employerId]
    );

    res.status(201).json({
      ...result.rows[0],
      company_name: company.rows[0]?.company_name || company_name || null,
    });
  } catch (error) {
    console.error('Create user error:', error);
    const status = error.status || 500;
    res.status(status).json({ error: error.message || 'Failed to create user' });
  }
});

// Update user (authenticated, admin only)
router.put('/:id', authMiddleware, checkPermission('users', 'edit'), async (req, res) => {
  const db = req.app.locals.db;
  const {
    email,
    first_name,
    last_name,
    phone,
    department,
    designation,
    role_id,
    is_admin,
    is_active,
  } = req.body;

  try {
    let normalizedRoleId = role_id || null;

    let userCheck;
    if (req.isSuperAdmin) {
      userCheck = await db.query('SELECT id, email, employer_id FROM users WHERE id = $1', [req.params.id]);
    } else {
      userCheck = await db.query(
        'SELECT id, email, employer_id FROM users WHERE id = $1 AND employer_id = $2',
        [req.params.id, req.employerId]
      );
    }

    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const targetEmployerId = userCheck.rows[0].employer_id;

    if (req.isSuperAdmin && normalizedRoleId) {
      normalizedRoleId = await mapPlatformRoleToCompanyRole(db, normalizedRoleId, targetEmployerId);
      if (!normalizedRoleId) {
        return res.status(400).json({ error: 'Invalid role' });
      }
    } else if (normalizedRoleId) {
      const roleCheck = await db.query(
        'SELECT id FROM roles WHERE id = $1 AND employer_id = $2',
        [normalizedRoleId, targetEmployerId]
      );
      if (roleCheck.rows.length === 0) {
        return res.status(400).json({ error: 'Invalid role' });
      }
    }

    if (email && email !== userCheck.rows[0].email) {
      const emailCheck = await db.query(
        'SELECT id FROM users WHERE lower(email) = lower($1) AND id != $2',
        [email, req.params.id]
      );
      if (emailCheck.rows.length > 0) {
        return res.status(409).json({ error: 'Email already in use by another user' });
      }
    }

    const result = await db.query(
      `UPDATE users
       SET email = COALESCE($1, email),
           first_name = COALESCE($2, first_name),
           last_name = COALESCE($3, last_name),
           phone = COALESCE($4, phone),
           department = $5,
           designation = $6,
           role_id = $7,
           is_admin = COALESCE($8, is_admin),
           is_active = COALESCE($9, is_active),
           updated_at = NOW()
       WHERE id = $10
       RETURNING id, email, first_name, last_name, phone, department, designation,
                 role_id, is_admin, is_active, updated_at, employer_id`,
      [
        email,
        first_name,
        last_name,
        phone,
        department || null,
        designation || null,
        normalizedRoleId,
        is_admin,
        is_active,
        req.params.id,
      ]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// Delete user (authenticated, admin only)
router.delete('/:id', authMiddleware, checkPermission('users', 'delete'), async (req, res) => {
  const db = req.app.locals.db;

  try {
    if (req.params.id === req.userId) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    let result;
    if (req.isSuperAdmin) {
      result = await db.query(
        'DELETE FROM users WHERE id = $1 RETURNING id, email',
        [req.params.id]
      );
    } else {
      result = await db.query(
        'DELETE FROM users WHERE id = $1 AND employer_id = $2 RETURNING id, email',
        [req.params.id, req.employerId]
      );
    }

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// Reset user password (authenticated, admin only)
router.post('/:id/reset-password', authMiddleware, checkPermission('users', 'edit'), async (req, res) => {
  const db = req.app.locals.db;
  const { new_password } = req.body;

  try {
    if (!new_password || new_password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const password_hash = await bcrypt.hash(new_password, 10);

    let result;
    if (req.isSuperAdmin) {
      result = await db.query(
        'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2 RETURNING id',
        [password_hash, req.params.id]
      );
    } else {
      result = await db.query(
        'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2 AND employer_id = $3 RETURNING id',
        [password_hash, req.params.id, req.employerId]
      );
    }

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ success: true, message: 'Password reset successfully' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

module.exports = router;
