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
    const employerId = payload.employerId;
    const userId = payload.userId;
    
    req.employerId = employerId;
    req.userId = userId;
    req.userType = payload.userType;
    
    next();
  } catch (error) {
    return res.status(401).json({ error: error.message === 'Token expired' ? 'Session expired' : 'Authentication failed' });
  }
}

module.exports = authMiddleware;
