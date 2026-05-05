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

// Login - supports both employers and team members
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const db = req.app.locals.db;
  
  console.log('🔐 Login attempt for:', email);
  
  try {
    // First, try to find in employers table (company owners)
    const employerResult = await db.query(
      'SELECT * FROM employers WHERE contact_email = $1',
      [email]
    );
    
    if (employerResult.rows.length > 0) {
      console.log('👤 Found employer:', employerResult.rows[0].id, employerResult.rows[0].company_name);
      
      const employer = employerResult.rows[0];
      
      // Check password
      const valid = await bcrypt.compare(password, employer.password_hash);
      console.log('🔑 Password valid:', valid);
      
      if (!valid) {
        console.log('❌ Invalid password for employer:', email);
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      
      // Remove password hash from response
      delete employer.password_hash;
      
      console.log('✅ Employer login successful for:', email);
      return res.json({ 
        employer,
        userType: 'employer'
      });
    }
    
    // If not found in employers, try users table (team members)
    const userResult = await db.query(
      `SELECT u.*, e.company_name, e.contact_email as employer_email,
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
    
    // Check password
    const valid = await bcrypt.compare(password, user.password_hash);
    console.log('🔑 Password valid:', valid);
    
    if (!valid) {
      console.log('❌ Invalid password for user:', email);
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Update last login
    await db.query(
      'UPDATE users SET last_login = NOW() WHERE id = $1',
      [user.id]
    );
    
    // Remove password hash from response
    delete user.password_hash;
    
    // Format response to match employer structure for frontend compatibility
    const userResponse = {
      id: user.id,
      employer_id: user.employer_id,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      phone: user.phone,
      company_name: user.company_name,
      role_id: user.role_id,
      role_name: user.role_name,
      role_description: user.role_description,
      is_admin: user.is_admin,
      is_active: user.is_active,
      last_login: user.last_login,
      created_at: user.created_at,
      updated_at: user.updated_at
    };
    
    console.log('✅ Team member login successful for:', email);
    res.json({ 
      employer: userResponse,
      userType: 'user'
    });
  } catch (error) {
    console.error('❌ Login error:', error);
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
