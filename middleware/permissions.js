// Permission checking middleware
async function checkPermission(resource, action) {
  return async (req, res, next) => {
    const db = req.app.locals.db;
    
    try {
      // Owner (employer) always has full access
      if (req.userId === req.employerId) {
        return next();
      }

      // Get user's role and permissions
      const userResult = await db.query(
        `SELECT u.role_id, u.is_admin, u.is_active
         FROM users u
         WHERE u.id = $1 AND u.employer_id = $2`,
        [req.userId, req.employerId]
      );

      if (userResult.rows.length === 0) {
        return res.status(403).json({ error: 'User not found or access denied' });
      }

      const user = userResult.rows[0];

      // Check if user is active
      if (!user.is_active) {
        return res.status(403).json({ error: 'User account is inactive' });
      }

      // Admins have full access
      if (user.is_admin) {
        return next();
      }

      // Check role permissions
      if (!user.role_id) {
        return res.status(403).json({ error: 'No role assigned to user' });
      }

      const permResult = await db.query(
        `SELECT can_read, can_write, can_edit, can_delete
         FROM permissions
         WHERE role_id = $1 AND resource = $2`,
        [user.role_id, resource]
      );

      if (permResult.rows.length === 0) {
        return res.status(403).json({ error: 'No permissions defined for this resource' });
      }

      const perm = permResult.rows[0];

      // Check specific action permission
      const actionMap = {
        'read': perm.can_read,
        'write': perm.can_write,
        'edit': perm.can_edit,
        'delete': perm.can_delete
      };

      if (!actionMap[action]) {
        return res.status(403).json({ 
          error: `You don't have permission to ${action} ${resource}`,
          required_permission: `${action}_${resource}`
        });
      }

      // Permission granted
      next();
    } catch (error) {
      console.error('Permission check error:', error);
      res.status(500).json({ error: 'Failed to check permissions' });
    }
  };
}

// Helper to check if user is admin
async function requireAdmin(req, res, next) {
  const db = req.app.locals.db;

  try {
    // Owner is always admin
    if (req.userId === req.employerId) {
      return next();
    }

    const result = await db.query(
      'SELECT is_admin, is_active FROM users WHERE id = $1 AND employer_id = $2',
      [req.userId, req.employerId]
    );

    if (result.rows.length === 0) {
      return res.status(403).json({ error: 'User not found' });
    }

    const user = result.rows[0];

    if (!user.is_active) {
      return res.status(403).json({ error: 'User account is inactive' });
    }

    if (!user.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    next();
  } catch (error) {
    console.error('Admin check error:', error);
    res.status(500).json({ error: 'Failed to verify admin status' });
  }
}

// Get user permissions (for frontend)
async function getUserPermissions(req, res) {
  const db = req.app.locals.db;

  try {
    // Owner has all permissions
    if (req.userId === req.employerId) {
      const allResources = ['jobs', 'applications', 'candidates', 'tests', 'interviews', 'analytics', 'settings', 'users'];
      const permissions = {};
      allResources.forEach(resource => {
        permissions[resource] = {
          can_read: true,
          can_write: true,
          can_edit: true,
          can_delete: true
        };
      });
      return res.json({ is_owner: true, is_admin: true, permissions });
    }

    // Get user info
    const userResult = await db.query(
      `SELECT u.role_id, u.is_admin, u.is_active
       FROM users u
       WHERE u.id = $1 AND u.employer_id = $2`,
      [req.userId, req.employerId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];

    // Admin has all permissions
    if (user.is_admin) {
      const allResources = ['jobs', 'applications', 'candidates', 'tests', 'interviews', 'analytics', 'settings', 'users'];
      const permissions = {};
      allResources.forEach(resource => {
        permissions[resource] = {
          can_read: true,
          can_write: true,
          can_edit: true,
          can_delete: true
        };
      });
      return res.json({ is_owner: false, is_admin: true, is_active: user.is_active, permissions });
    }

    // Get role permissions
    if (!user.role_id) {
      return res.json({ is_owner: false, is_admin: false, is_active: user.is_active, permissions: {} });
    }

    const permResult = await db.query(
      `SELECT resource, can_read, can_write, can_edit, can_delete
       FROM permissions
       WHERE role_id = $1`,
      [user.role_id]
    );

    const permissions = {};
    permResult.rows.forEach(perm => {
      permissions[perm.resource] = {
        can_read: perm.can_read,
        can_write: perm.can_write,
        can_edit: perm.can_edit,
        can_delete: perm.can_delete
      };
    });

    res.json({ 
      is_owner: false, 
      is_admin: false, 
      is_active: user.is_active,
      role_id: user.role_id,
      permissions 
    });
  } catch (error) {
    console.error('Get permissions error:', error);
    res.status(500).json({ error: 'Failed to get permissions' });
  }
}

module.exports = {
  checkPermission,
  requireAdmin,
  getUserPermissions
};
