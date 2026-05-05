const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');

// Get all roles for employer (authenticated)
router.get('/', authMiddleware, async (req, res) => {
  const db = req.app.locals.db;

  try {
    const result = await db.query(
      `SELECT r.id, r.name, r.description, r.is_system_role, r.created_at, r.updated_at,
              COUNT(u.id) as user_count
       FROM roles r
       LEFT JOIN users u ON r.id = u.role_id
       WHERE r.employer_id = $1
       GROUP BY r.id
       ORDER BY r.is_system_role DESC, r.created_at ASC`,
      [req.employerId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Get roles error:', error);
    res.status(500).json({ error: 'Failed to fetch roles' });
  }
});

// Get single role with permissions (authenticated)
router.get('/:id', authMiddleware, async (req, res) => {
  const db = req.app.locals.db;

  try {
    // Get role
    const roleResult = await db.query(
      `SELECT r.id, r.name, r.description, r.is_system_role, r.created_at, r.updated_at,
              COUNT(u.id) as user_count
       FROM roles r
       LEFT JOIN users u ON r.id = u.role_id
       WHERE r.id = $1 AND r.employer_id = $2
       GROUP BY r.id`,
      [req.params.id, req.employerId]
    );

    if (roleResult.rows.length === 0) {
      return res.status(404).json({ error: 'Role not found' });
    }

    // Get permissions
    const permissionsResult = await db.query(
      `SELECT id, resource, can_read, can_write, can_edit, can_delete
       FROM permissions
       WHERE role_id = $1
       ORDER BY resource`,
      [req.params.id]
    );

    const role = roleResult.rows[0];
    role.permissions = permissionsResult.rows;

    res.json(role);
  } catch (error) {
    console.error('Get role error:', error);
    res.status(500).json({ error: 'Failed to fetch role' });
  }
});

// Create new role (authenticated, admin only)
router.post('/', authMiddleware, async (req, res) => {
  const db = req.app.locals.db;
  const { name, description, permissions } = req.body;

  try {
    // Check if requester is admin
    const requester = await db.query(
      'SELECT is_admin FROM users WHERE id = $1 AND employer_id = $2',
      [req.userId, req.employerId]
    );

    const isOwner = req.userId === req.employerId;
    const isAdmin = requester.rows.length > 0 && requester.rows[0].is_admin;

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: 'Only admins can create roles' });
    }

    // Validate required fields
    if (!name) {
      return res.status(400).json({ error: 'Role name is required' });
    }

    // Check if role name already exists
    const existing = await db.query(
      'SELECT id FROM roles WHERE employer_id = $1 AND name = $2',
      [req.employerId, name]
    );

    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Role with this name already exists' });
    }

    // Create role
    const roleResult = await db.query(
      `INSERT INTO roles (employer_id, name, description, is_system_role, created_at, updated_at)
       VALUES ($1, $2, $3, false, NOW(), NOW())
       RETURNING id, name, description, is_system_role, created_at, updated_at`,
      [req.employerId, name, description]
    );

    const role = roleResult.rows[0];

    // Create permissions if provided
    if (permissions && Array.isArray(permissions)) {
      for (const perm of permissions) {
        await db.query(
          `INSERT INTO permissions (role_id, resource, can_read, can_write, can_edit, can_delete)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            role.id,
            perm.resource,
            perm.can_read || false,
            perm.can_write || false,
            perm.can_edit || false,
            perm.can_delete || false
          ]
        );
      }
    }

    // Get role with permissions
    const permissionsResult = await db.query(
      'SELECT id, resource, can_read, can_write, can_edit, can_delete FROM permissions WHERE role_id = $1',
      [role.id]
    );

    role.permissions = permissionsResult.rows;

    // Log activity - only if userId exists in users table
    try {
      await db.query(
        `INSERT INTO user_activity_log (user_id, employer_id, action, resource_type, resource_id, details)
         VALUES ($1, $2, 'create_role', 'role', $3, $4)`,
        [req.userId, req.employerId, role.id, JSON.stringify({ name })]
      );
    } catch (logError) {
      // If logging fails (e.g., user_id not in users table), just log to console
      console.log('Activity log skipped:', logError.message);
    }

    res.status(201).json(role);
  } catch (error) {
    console.error('Create role error:', error);
    res.status(500).json({ error: 'Failed to create role' });
  }
});

// Update role (authenticated, admin only)
router.put('/:id', authMiddleware, async (req, res) => {
  const db = req.app.locals.db;
  const { name, description, permissions } = req.body;

  try {
    // Check if requester is admin
    const requester = await db.query(
      'SELECT is_admin FROM users WHERE id = $1 AND employer_id = $2',
      [req.userId, req.employerId]
    );

    const isOwner = req.userId === req.employerId;
    const isAdmin = requester.rows.length > 0 && requester.rows[0].is_admin;

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: 'Only admins can update roles' });
    }

    // Check if role exists
    const roleCheck = await db.query(
      'SELECT id, is_system_role FROM roles WHERE id = $1 AND employer_id = $2',
      [req.params.id, req.employerId]
    );

    if (roleCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Role not found' });
    }

    // Update role
    const roleResult = await db.query(
      `UPDATE roles
       SET name = COALESCE($1, name),
           description = COALESCE($2, description),
           updated_at = NOW()
       WHERE id = $3 AND employer_id = $4
       RETURNING id, name, description, is_system_role, created_at, updated_at`,
      [name, description, req.params.id, req.employerId]
    );

    const role = roleResult.rows[0];

    // Update permissions if provided
    if (permissions && Array.isArray(permissions)) {
      // Delete existing permissions
      await db.query('DELETE FROM permissions WHERE role_id = $1', [role.id]);

      // Insert new permissions
      for (const perm of permissions) {
        await db.query(
          `INSERT INTO permissions (role_id, resource, can_read, can_write, can_edit, can_delete)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            role.id,
            perm.resource,
            perm.can_read || false,
            perm.can_write || false,
            perm.can_edit || false,
            perm.can_delete || false
          ]
        );
      }
    }

    // Get role with permissions
    const permissionsResult = await db.query(
      'SELECT id, resource, can_read, can_write, can_edit, can_delete FROM permissions WHERE role_id = $1',
      [role.id]
    );

    role.permissions = permissionsResult.rows;

    // Log activity - only if userId exists in users table
    try {
      await db.query(
        `INSERT INTO user_activity_log (user_id, employer_id, action, resource_type, resource_id, details)
         VALUES ($1, $2, 'update_role', 'role', $3, $4)`,
        [req.userId, req.employerId, role.id, JSON.stringify({ name })]
      );
    } catch (logError) {
      // If logging fails (e.g., user_id not in users table), just log to console
      console.log('Activity log skipped:', logError.message);
    }

    res.json(role);
  } catch (error) {
    console.error('Update role error:', error);
    res.status(500).json({ error: 'Failed to update role' });
  }
});

// Delete role (authenticated, admin only)
router.delete('/:id', authMiddleware, async (req, res) => {
  const db = req.app.locals.db;

  try {
    // Check if requester is admin
    const requester = await db.query(
      'SELECT is_admin FROM users WHERE id = $1 AND employer_id = $2',
      [req.userId, req.employerId]
    );

    const isOwner = req.userId === req.employerId;
    const isAdmin = requester.rows.length > 0 && requester.rows[0].is_admin;

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: 'Only admins can delete roles' });
    }

    // Check if role exists
    const roleCheck = await db.query(
      'SELECT id, is_system_role, name FROM roles WHERE id = $1 AND employer_id = $2',
      [req.params.id, req.employerId]
    );

    if (roleCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Role not found' });
    }

    // Check if role is assigned to any users
    const usersCheck = await db.query(
      'SELECT COUNT(*) as count FROM users WHERE role_id = $1',
      [req.params.id]
    );

    if (parseInt(usersCheck.rows[0].count) > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete role that is assigned to users',
        user_count: parseInt(usersCheck.rows[0].count)
      });
    }

    // Delete role (permissions will be deleted via CASCADE)
    await db.query(
      'DELETE FROM roles WHERE id = $1 AND employer_id = $2',
      [req.params.id, req.employerId]
    );

    // Log activity - only if userId exists in users table
    try {
      await db.query(
        `INSERT INTO user_activity_log (user_id, employer_id, action, resource_type, resource_id, details)
         VALUES ($1, $2, 'delete_role', 'role', $3, $4)`,
        [req.userId, req.employerId, req.params.id, JSON.stringify({ name: roleCheck.rows[0].name })]
      );
    } catch (logError) {
      // If logging fails (e.g., user_id not in users table), just log to console
      console.log('Activity log skipped:', logError.message);
    }

    res.json({ success: true, message: 'Role deleted successfully' });
  } catch (error) {
    console.error('Delete role error:', error);
    res.status(500).json({ error: 'Failed to delete role' });
  }
});

// Update role permissions (authenticated, admin only)
router.put('/:id/permissions', authMiddleware, async (req, res) => {
  const db = req.app.locals.db;
  const { permissions } = req.body;

  try {
    // Check if requester is admin
    const requester = await db.query(
      'SELECT is_admin FROM users WHERE id = $1 AND employer_id = $2',
      [req.userId, req.employerId]
    );

    const isOwner = req.userId === req.employerId;
    const isAdmin = requester.rows.length > 0 && requester.rows[0].is_admin;

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: 'Only admins can update permissions' });
    }

    // Check if role exists
    const roleCheck = await db.query(
      'SELECT id, is_system_role FROM roles WHERE id = $1 AND employer_id = $2',
      [req.params.id, req.employerId]
    );

    if (roleCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Role not found' });
    }

    if (!permissions || !Array.isArray(permissions)) {
      return res.status(400).json({ error: 'Permissions array is required' });
    }

    // Delete existing permissions
    await db.query('DELETE FROM permissions WHERE role_id = $1', [req.params.id]);

    // Insert new permissions
    for (const perm of permissions) {
      await db.query(
        `INSERT INTO permissions (role_id, resource, can_read, can_write, can_edit, can_delete)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          req.params.id,
          perm.resource,
          perm.can_read || false,
          perm.can_write || false,
          perm.can_edit || false,
          perm.can_delete || false
        ]
      );
    }

    // Get updated permissions
    const result = await db.query(
      'SELECT id, resource, can_read, can_write, can_edit, can_delete FROM permissions WHERE role_id = $1',
      [req.params.id]
    );

    // Log activity - only if userId exists in users table
    try {
      await db.query(
        `INSERT INTO user_activity_log (user_id, employer_id, action, resource_type, resource_id)
         VALUES ($1, $2, 'update_permissions', 'role', $3)`,
        [req.userId, req.employerId, req.params.id]
      );
    } catch (logError) {
      // If logging fails (e.g., user_id not in users table), just log to console
      console.log('Activity log skipped:', logError.message);
    }

    res.json(result.rows);
  } catch (error) {
    console.error('Update permissions error:', error);
    res.status(500).json({ error: 'Failed to update permissions' });
  }
});

// Get available resources
router.get('/resources/list', authMiddleware, async (req, res) => {
  const resources = [
    { id: 'jobs', name: 'Jobs', description: 'Manage job postings' },
    { id: 'applications', name: 'Applications', description: 'Review and manage applications' },
    { id: 'candidates', name: 'Candidates', description: 'View and manage candidate profiles' },
    { id: 'tests', name: 'Tests', description: 'Create and manage assessment tests' },
    { id: 'interviews', name: 'Interviews', description: 'Schedule and conduct interviews' },
    { id: 'analytics', name: 'Analytics', description: 'View reports and analytics' },
    { id: 'settings', name: 'Settings', description: 'Manage company settings' },
    { id: 'users', name: 'Users', description: 'Manage team members and permissions' }
  ];

  res.json(resources);
});

module.exports = router;
