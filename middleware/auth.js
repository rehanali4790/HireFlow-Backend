// Simple auth middleware - checks for employer ID in header
function authMiddleware(req, res, next) {
  try {
    const employerId = req.headers['x-employer-id'];
    
    if (!employerId) {
      return res.status(401).json({ error: 'No employer ID provided' });
    }
    
    req.employerId = employerId;
    
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Authentication failed' });
  }
}

module.exports = authMiddleware;
