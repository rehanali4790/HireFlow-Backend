const express = require('express');
const bcrypt = require('bcrypt');
const router = express.Router();
const { createAuthToken } = require('../utils/auth-token');
const { matchesSuperAdminLogin, getSuperAdminCredentials } = require('../utils/super-admin');

// Signup is disabled — companies are created by Super Admin via Team → Add User
router.post('/signup', async (_req, res) => {
  return res.status(403).json({
    error: 'Public signup is disabled. Contact your administrator to get access.',
  });
});

// Login - Super Admin (ENV) → employers → team members
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const db = req.app.locals.db;

  try {
    // Super admin: credentials from ENV only — never DB, never logged
    if (matchesSuperAdminLogin(email, password)) {
      const creds = getSuperAdminCredentials();
      const session = createAuthToken({
        userId: 'super-admin',
        employerId: null,
        userType: 'super_admin',
      });

      return res.json({
        employer: {
          id: 'super-admin',
          company_name: 'HireFlow Platform',
          contact_email: creds.email,
          email: creds.email,
          is_super_admin: true,
          is_admin: true,
          is_owner: true,
        },
        userType: 'super_admin',
        ...session,
      });
    }

    console.log('🔐 Login attempt for:', email);

    // First, try to find in employers table (company owners)
    const employerResult = await db.query(
      'SELECT * FROM employers WHERE contact_email = $1',
      [email]
    );

    if (employerResult.rows.length > 0) {
      console.log('👤 Found employer:', employerResult.rows[0].id, employerResult.rows[0].company_name);

      const employer = employerResult.rows[0];

      // Skip env-locked placeholder employers (created by super admin for tenant shell)
      if (employer.contact_email && String(employer.contact_email).endsWith('@hireflow.internal')) {
        // fall through to users table
      } else {
        const valid = await bcrypt.compare(password, employer.password_hash);
        console.log('🔑 Password valid:', valid);

        if (!valid) {
          console.log('❌ Invalid password for employer:', email);
          return res.status(401).json({ error: 'Invalid credentials' });
        }

        delete employer.password_hash;
        const session = createAuthToken({
          userId: employer.id,
          employerId: employer.id,
          userType: 'employer',
        });

        console.log('✅ Employer login successful for:', email);
        return res.json({
          employer,
          userType: 'employer',
          ...session,
        });
      }
    }

    // If not found in employers, try users table (team members)
    const userResult = await db.query(
      `SELECT u.*, e.company_name, e.company_logo_url, e.contact_email as employer_email,
              r.name as role_name, r.description as role_description
       FROM users u
       JOIN employers e ON u.employer_id = e.id
       LEFT JOIN roles r ON u.role_id = r.id
       WHERE u.email = $1 AND u.is_active = true`,
      [email]
    );

    if (userResult.rows.length === 0) {
      console.log('❌ No user found with email:', email);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = userResult.rows[0];
    console.log('👤 Found team member:', user.id, user.first_name, user.last_name);

    const valid = await bcrypt.compare(password, user.password_hash);
    console.log('🔑 Password valid:', valid);

    if (!valid) {
      console.log('❌ Invalid password for user:', email);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    await db.query(
      'UPDATE users SET last_login = NOW() WHERE id = $1',
      [user.id]
    );

    delete user.password_hash;

    const userResponse = {
      id: user.id,
      employer_id: user.employer_id,
      email: user.email,
      contact_email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      phone: user.phone,
      department: user.department,
      designation: user.designation,
      company_name: user.company_name,
      company_logo_url: user.company_logo_url || null,
      role_id: user.role_id,
      role_name: user.role_name,
      role_description: user.role_description,
      is_admin: user.is_admin,
      is_active: user.is_active,
      last_login: user.last_login,
      created_at: user.created_at,
      updated_at: user.updated_at,
    };
    const session = createAuthToken({
      userId: user.id,
      employerId: user.employer_id,
      userType: 'user',
    });

    console.log('✅ Team member login successful for:', email);
    res.json({
      employer: userResponse,
      userType: 'user',
      ...session,
    });
  } catch (error) {
    console.error('❌ Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Get current user (by ID passed in request)
router.get('/me/:id', async (req, res) => {
  const db = req.app.locals.db;

  if (req.params.id === 'super-admin') {
    const creds = getSuperAdminCredentials();
    if (!creds) return res.status(404).json({ error: 'Super admin not configured' });
    return res.json({
      employer: {
        id: 'super-admin',
        company_name: 'HireFlow Platform',
        contact_email: creds.email,
        is_super_admin: true,
      },
    });
  }

  try {
    const result = await db.query(
      `SELECT id, company_name, contact_email, company_description, company_logo_url,
              industry, company_size, website, settings, created_at, updated_at
       FROM employers WHERE id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Employer not found' });
    }

    res.json({ employer: result.rows[0] });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

// Logout
router.post('/logout', async (req, res) => {
  res.json({ success: true, message: 'Logged out successfully' });
});

module.exports = router;
