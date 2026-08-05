const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const { checkPermission, hasPermissionValue } = require('../middleware/permissions');
const { resolveRolesEmployerId } = require('../utils/platform-employer');

// Get all roles (super admin = platform templates; tenant = company roles)
router.get('/', authMiddleware, checkPermission('roles', 'read'), async (req, res) => {
  const db = req.app.locals.db;

  try {
    const employerId = await resolveRolesEmployerId(req, db);
    if (!employerId) {
      return res.status(400).json({ error: 'Company context required' });
    }

    const result = await db.query(
      `SELECT r.id, r.name, r.description, r.is_system_role, r.created_at, r.updated_at,
              COUNT(u.id) as user_count
       FROM roles r
       LEFT JOIN users u ON r.id = u.role_id
       WHERE r.employer_id = $1
       GROUP BY r.id
       ORDER BY r.is_system_role DESC, r.created_at ASC`,
      [employerId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Get roles error:', error);
    res.status(500).json({ error: 'Failed to fetch roles' });
  }
});

// Get available resources (must be before /:id)
router.get('/resources/list', authMiddleware, async (req, res) => {
  const db = req.app.locals.db;

  try {
    const canReadRoles = await hasPermissionValue(req, 'roles', 'read');
    const canEditRoles = await hasPermissionValue(req, 'roles', 'edit');

    if (!canReadRoles && !canEditRoles) {
      return res.status(403).json({ error: 'You do not have permission to view permission resources' });
    }

    const result = await db.query(
      `SELECT id, name, description, category, sort_order
       FROM permission_resources
       WHERE is_active = true
       ORDER BY category, sort_order, name`
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Get permission resources error:', error);
    res.status(500).json({ error: 'Failed to fetch permission resources' });
  }
});

// Get single role with permissions (authenticated)
router.get('/:id', authMiddleware, checkPermission('roles', 'read'), async (req, res) => {
  const db = req.app.locals.db;

  try {
    const employerId = await resolveRolesEmployerId(req, db);
    if (!employerId) {
      return res.status(400).json({ error: 'Company context required' });
    }

    const roleResult = await db.query(
      `SELECT r.id, r.name, r.description, r.is_system_role, r.created_at, r.updated_at,
              COUNT(u.id) as user_count
       FROM roles r
       LEFT JOIN users u ON r.id = u.role_id
       WHERE r.id = $1 AND r.employer_id = $2
       GROUP BY r.id`,
      [req.params.id, employerId]
    );

    if (roleResult.rows.length === 0) {
      return res.status(404).json({ error: 'Role not found' });
    }

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
router.post('/', authMiddleware, checkPermission('roles', 'write'), async (req, res) => {
  const db = req.app.locals.db;
  const { name, description, permissions } = req.body;

  try {
    const employerId = await resolveRolesEmployerId(req, db);
    if (!employerId) {
      return res.status(400).json({ error: 'Company context required' });
    }

    if (!name) {
      return res.status(400).json({ error: 'Role name is required' });
    }

    const existing = await db.query(
      'SELECT id FROM roles WHERE employer_id = $1 AND name = $2',
      [employerId, name]
    );

    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Role with this name already exists' });
    }

    const roleResult = await db.query(
      `INSERT INTO roles (employer_id, name, description, is_system_role, created_at, updated_at)
       VALUES ($1, $2, $3, false, NOW(), NOW())
       RETURNING id, name, description, is_system_role, created_at, updated_at`,
      [employerId, name, description]
    );

    const role = roleResult.rows[0];

    if (permissions && Array.isArray(permissions)) {
      const byResource = new Map();
      for (const perm of permissions) {
        const resource = typeof perm?.resource === 'string' ? perm.resource.trim() : '';
        if (!resource) continue;
        byResource.set(resource, {
          resource,
          can_read: !!perm.can_read,
          can_write: !!perm.can_write,
          can_edit: !!perm.can_edit,
          can_delete: !!perm.can_delete,
        });
      }

      for (const perm of byResource.values()) {
        await db.query(
          `INSERT INTO permissions (role_id, resource, can_read, can_write, can_edit, can_delete)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            role.id,
            perm.resource,
            perm.can_read,
            perm.can_write,
            perm.can_edit,
            perm.can_delete,
          ]
        );
      }
    }

    const permissionsResult = await db.query(
      'SELECT id, resource, can_read, can_write, can_edit, can_delete FROM permissions WHERE role_id = $1',
      [role.id]
    );

    role.permissions = permissionsResult.rows;

    res.status(201).json(role);
  } catch (error) {
    console.error('Create role error:', error);
    res.status(500).json({ error: 'Failed to create role' });
  }
});

// Update role (authenticated, admin only)
router.put('/:id', authMiddleware, checkPermission('roles', 'edit'), async (req, res) => {
  const db = req.app.locals.db;
  const { name, description, permissions } = req.body;

  try {
    const employerId = await resolveRolesEmployerId(req, db);
    if (!employerId) {
      return res.status(400).json({ error: 'Company context required' });
    }

    const roleCheck = await db.query(
      'SELECT id, is_system_role FROM roles WHERE id = $1 AND employer_id = $2',
      [req.params.id, employerId]
    );

    if (roleCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Role not found' });
    }

    const client = await db.connect();
    try {
      await client.query('BEGIN');

      const roleResult = await client.query(
        `UPDATE roles
         SET name = COALESCE($1, name),
             description = COALESCE($2, description),
             updated_at = NOW()
         WHERE id = $3 AND employer_id = $4
         RETURNING id, name, description, is_system_role, created_at, updated_at`,
        [name, description, req.params.id, employerId]
      );

      const role = roleResult.rows[0];

      if (permissions && Array.isArray(permissions)) {
        // Deduplicate + drop invalid rows (null/empty resource caused 500s)
        const byResource = new Map();
        for (const perm of permissions) {
          const resource = typeof perm?.resource === 'string' ? perm.resource.trim() : '';
          if (!resource) continue;
          byResource.set(resource, {
            resource,
            can_read: !!perm.can_read,
            can_write: !!perm.can_write,
            can_edit: !!perm.can_edit,
            can_delete: !!perm.can_delete,
          });
        }

        await client.query('DELETE FROM permissions WHERE role_id = $1', [role.id]);

        for (const perm of byResource.values()) {
          await client.query(
            `INSERT INTO permissions (role_id, resource, can_read, can_write, can_edit, can_delete)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [
              role.id,
              perm.resource,
              perm.can_read,
              perm.can_write,
              perm.can_edit,
              perm.can_delete,
            ]
          );
        }
      }

      const permissionsResult = await client.query(
        'SELECT id, resource, can_read, can_write, can_edit, can_delete FROM permissions WHERE role_id = $1',
        [role.id]
      );

      await client.query('COMMIT');

      role.permissions = permissionsResult.rows;
      res.json(role);
    } catch (innerError) {
      await client.query('ROLLBACK');
      throw innerError;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Update role error:', error);
    res.status(500).json({
      error: 'Failed to update role',
      message: error.message || undefined,
    });
  }
});

// Delete role (authenticated, admin only)
router.delete('/:id', authMiddleware, checkPermission('roles', 'delete'), async (req, res) => {
  const db = req.app.locals.db;

  try {
    const employerId = await resolveRolesEmployerId(req, db);
    if (!employerId) {
      return res.status(400).json({ error: 'Company context required' });
    }

    const roleCheck = await db.query(
      'SELECT id, is_system_role, name FROM roles WHERE id = $1 AND employer_id = $2',
      [req.params.id, employerId]
    );

    if (roleCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Role not found' });
    }

    const usersCheck = await db.query(
      'SELECT COUNT(*) as count FROM users WHERE role_id = $1',
      [req.params.id]
    );

    if (parseInt(usersCheck.rows[0].count, 10) > 0) {
      return res.status(400).json({
        error: 'Cannot delete role that is assigned to users',
        user_count: parseInt(usersCheck.rows[0].count, 10),
      });
    }

    await db.query(
      'DELETE FROM roles WHERE id = $1 AND employer_id = $2',
      [req.params.id, employerId]
    );

    res.json({ success: true, message: 'Role deleted successfully' });
  } catch (error) {
    console.error('Delete role error:', error);
    res.status(500).json({ error: 'Failed to delete role' });
  }
});

// Update role permissions (authenticated, admin only)
router.put('/:id/permissions', authMiddleware, checkPermission('roles', 'edit'), async (req, res) => {
  const db = req.app.locals.db;
  const { permissions } = req.body;

  try {
    const employerId = await resolveRolesEmployerId(req, db);
    if (!employerId) {
      return res.status(400).json({ error: 'Company context required' });
    }

    const roleCheck = await db.query(
      'SELECT id, is_system_role FROM roles WHERE id = $1 AND employer_id = $2',
      [req.params.id, employerId]
    );

    if (roleCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Role not found' });
    }

    if (!permissions || !Array.isArray(permissions)) {
      return res.status(400).json({ error: 'Permissions array is required' });
    }

    await db.query('DELETE FROM permissions WHERE role_id = $1', [req.params.id]);

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
          perm.can_delete || false,
        ]
      );
    }

    const result = await db.query(
      'SELECT id, resource, can_read, can_write, can_edit, can_delete FROM permissions WHERE role_id = $1',
      [req.params.id]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Update permissions error:', error);
    res.status(500).json({ error: 'Failed to update permissions' });
  }
});

module.exports = router;
