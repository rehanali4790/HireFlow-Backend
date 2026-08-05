const { verifyAuthToken } = require('../utils/auth-token');

// Enhanced auth middleware - validates signed 6-hour auth tokens.
function authMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
      return res.status(401).json({ error: 'Authentication token required' });
    }

    const payload = verifyAuthToken(token);
    const userType = payload.userType;
    const isSuperAdmin = userType === 'super_admin';

    req.userType = userType;
    req.isSuperAdmin = isSuperAdmin;
    req.userId = payload.userId;

    if (isSuperAdmin) {
      // Super admin can operate on a selected company via X-Tenant-Id
      const tenantId = req.headers['x-tenant-id'] || req.headers['x-employer-id'] || null;
      req.employerId = tenantId && tenantId !== 'super-admin' ? tenantId : null;
      req.userId = 'super-admin';
    } else {
      req.employerId = payload.employerId;
    }

    next();
  } catch (error) {
    return res.status(401).json({
      error: error.message === 'Token expired' ? 'Session expired' : 'Authentication failed',
    });
  }
}

module.exports = authMiddleware;
