const express = require('express');
const bcrypt = require('bcrypt');
const router = express.Router();

// Signup
router.post('/signup', async (req, res) => {
  const { email, password, companyName } = req.body;
  const db = req.app.locals.db;
  
  try {
    // Check if email already exists
    const existing = await db.query(
      'SELECT id FROM employers WHERE contact_email = $1',
      [email]
    );
    
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Email already registered' });
    }
    
    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);
    
    // Insert employer
    const result = await db.query(
      `INSERT INTO employers (contact_email, password_hash, company_name, created_at, updated_at)
       VALUES ($1, $2, $3, NOW(), NOW())
       RETURNING id, company_name, contact_email, company_description, company_logo_url, 
                 industry, company_size, website, settings, created_at, updated_at`,
      [email, passwordHash, companyName]
    );
    
    const employer = result.rows[0];
    
    res.status(201).json({ employer });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Failed to create account' });
  }
});

// Login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const db = req.app.locals.db;
  
  try {
    // Find employer
    const result = await db.query(
      'SELECT * FROM employers WHERE contact_email = $1',
      [email]
    );
    
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const employer = result.rows[0];
    
    // Check password
    const valid = await bcrypt.compare(password, employer.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Remove password hash from response
    delete employer.password_hash;
    
    res.json({ employer });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Get current user (by ID passed in request)
router.get('/me/:id', async (req, res) => {
  const db = req.app.locals.db;
  
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
