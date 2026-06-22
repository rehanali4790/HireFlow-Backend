const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const authMiddleware = require('../middleware/auth');
const { checkPermission } = require('../middleware/permissions');

// Get all users for employer (authenticated)
router.get('/', authMiddleware, checkPermission('users', 'read'), async (req, res) => {
  const db = req.app.locals.db;

  try {
    const result = await db.query(
      `SELECT u.id, u.email, u.first_name, u.last_name, u.phone, u.avatar_url,
              u.department, u.designation,
              u.is_active, u.is_admin, u.last_login, u.created_at, u.updated_at,
              u.role_id, r.name as role_name, r.description as role_description
       FROM users u
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
    const result = await db.query(
      `SELECT u.id, u.email, u.first_name, u.last_name, u.phone, u.avatar_url,
              u.department, u.designation,
              u.is_active, u.is_admin, u.last_login, u.created_at, u.updated_at,
              u.role_id, r.name as role_name, r.description as role_description
       FROM users u
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

// Create new user (authenticated, admin only)
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
    is_admin
  } = req.body;

  try {
    const normalizedRoleId = role_id || null;

    // Validate required fields
    if (!email || !first_name || !last_name || !password) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Check if email already exists for this employer
    const existing = await db.query(
      'SELECT id FROM users WHERE employer_id = $1 AND email = $2',
      [req.employerId, email]
    );

    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'User with this email already exists' });
    }

    // Verify role belongs to this employer
    if (normalizedRoleId) {
      const roleCheck = await db.query(
        'SELECT id FROM roles WHERE id = $1 AND employer_id = $2',
        [normalizedRoleId, req.employerId]
      );

      if (roleCheck.rows.length === 0) {
        return res.status(400).json({ error: 'Invalid role' });
      }
    }

    // Hash password
    const password_hash = await bcrypt.hash(password, 10);

    // Create user
    const result = await db.query(
      `INSERT INTO users (
        employer_id, email, first_name, last_name, password_hash,
        phone, department, designation, role_id, is_admin, is_active, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true, NOW(), NOW())
      RETURNING id, email, first_name, last_name, phone, department, designation, role_id, is_admin, is_active, created_at`,
      [req.employerId, email, first_name, last_name, password_hash, phone, department || null, designation || null, normalizedRoleId, is_admin || false]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ error: 'Failed to create user' });
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
    is_active
  } = req.body;

  try {
    const normalizedRoleId = role_id || null;

    // Verify user belongs to this employer
    const userCheck = await db.query(
      'SELECT id FROM users WHERE id = $1 AND employer_id = $2',
      [req.params.id, req.employerId]
    );

    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify role belongs to this employer if provided
    if (normalizedRoleId) {
      const roleCheck = await db.query(
        'SELECT id FROM roles WHERE id = $1 AND employer_id = $2',
        [normalizedRoleId, req.employerId]
      );

      if (roleCheck.rows.length === 0) {
        return res.status(400).json({ error: 'Invalid role' });
      }
    }

    // If email is being changed, verify it's unique
    if (email && email !== userCheck.rows[0].email) {
      const emailCheck = await db.query(
        'SELECT id FROM users WHERE employer_id = $1 AND email = $2 AND id != $3',
        [req.employerId, email, req.params.id]
      );

      if (emailCheck.rows.length > 0) {
        return res.status(409).json({ error: 'Email already in use by another user' });
      }
    }

    // Update user
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
       WHERE id = $10 AND employer_id = $11
       RETURNING id, email, first_name, last_name, phone, department, designation, role_id, is_admin, is_active, updated_at`,
      [email, first_name, last_name, phone, department || null, designation || null, normalizedRoleId, is_admin, is_active, req.params.id, req.employerId]
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
    // Prevent deleting yourself
    if (req.params.id === req.userId) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    // Delete user
    const result = await db.query(
      'DELETE FROM users WHERE id = $1 AND employer_id = $2 RETURNING id, email',
      [req.params.id, req.employerId]
    );

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

    // Hash new password
    const password_hash = await bcrypt.hash(new_password, 10);

    // Update password
    const result = await db.query(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2 AND employer_id = $3 RETURNING id',
      [password_hash, req.params.id, req.employerId]
    );

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
