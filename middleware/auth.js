// Enhanced auth middleware - supports both employer and user authentication
function authMiddleware(req, res, next) {
  try {
    const employerId = req.headers['x-employer-id'];
    const userId = req.headers['x-user-id']; // Optional: for team member authentication
    
    if (!employerId) {
      return res.status(401).json({ error: 'No employer ID provided' });
    }
    
    req.employerId = employerId;
    
    // If userId is provided, use it; otherwise, assume it's the employer (owner)
    // For team members, userId will be their user.id and employerId will be their employer_id
    req.userId = userId || employerId;
    
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Authentication failed' });
  }
}

module.exports = authMiddleware;
