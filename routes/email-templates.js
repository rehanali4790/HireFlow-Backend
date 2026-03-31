const express = require('express');
const authMiddleware = require('../middleware/auth');
const router = express.Router();

// Get all email templates for employer (authenticated)
router.get('/', authMiddleware, async (req, res) => {
  const db = req.app.locals.db;
  
  try {
    const result = await db.query(
      `SELECT * FROM email_templates
       WHERE employer_id = $1
       ORDER BY created_at DESC`,
      [req.employerId]
    );
    
    res.json(result.rows);
  } catch (error) {
    console.error('Get email templates error:', error);
    res.status(500).json({ error: 'Failed to fetch email templates' });
  }
});

// Get single email template
router.get('/:id', authMiddleware, async (req, res) => {
  const db = req.app.locals.db;
  
  try {
    const result = await db.query(
      'SELECT * FROM email_templates WHERE id = $1 AND employer_id = $2',
      [req.params.id, req.employerId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Email template not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get email template error:', error);
    res.status(500).json({ error: 'Failed to fetch email template' });
  }
});

// Create email template (authenticated)
router.post('/', authMiddleware, async (req, res) => {
  const db = req.app.locals.db;
  const { name, subject, body, templateType } = req.body;
  
  try {
    const result = await db.query(
      `INSERT INTO email_templates (
        employer_id, name, subject, body, template_type, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
      RETURNING *`,
      [req.employerId, name, subject, body, templateType]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create email template error:', error);
    res.status(500).json({ error: 'Failed to create email template' });
  }
});

// Update email template (authenticated)
router.put('/:id', authMiddleware, async (req, res) => {
  const db = req.app.locals.db;
  const { name, subject, body, templateType } = req.body;
  
  try {
    const result = await db.query(
      `UPDATE email_templates
       SET name = $1, subject = $2, body = $3, template_type = $4, updated_at = NOW()
       WHERE id = $5 AND employer_id = $6
       RETURNING *`,
      [name, subject, body, templateType, req.params.id, req.employerId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Email template not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update email template error:', error);
    res.status(500).json({ error: 'Failed to update email template' });
  }
});

// Delete email template (authenticated)
router.delete('/:id', authMiddleware, async (req, res) => {
  const db = req.app.locals.db;
  
  try {
    const result = await db.query(
      'DELETE FROM email_templates WHERE id = $1 AND employer_id = $2 RETURNING id',
      [req.params.id, req.employerId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Email template not found' });
    }
    
    res.json({ success: true, message: 'Email template deleted' });
  } catch (error) {
    console.error('Delete email template error:', error);
    res.status(500).json({ error: 'Failed to delete email template' });
  }
});

module.exports = router;
