const express = require('express');
const authMiddleware = require('../middleware/auth');
const router = express.Router();

// Extend offer to candidate (authenticated)
router.post('/', authMiddleware, async (req, res) => {
  const db = req.app.locals.db;
  const emailService = require('../services/email-service');
  
  const {
    applicationId,
    salaryAmount,
    salaryCurrency = 'USD',
    startDate,
    positionTitle,
    employmentType,
    benefits,
    additionalNotes
  } = req.body;
  
  try {
    console.log('💼 Extending offer for application:', applicationId);
    
    // Get application details
    const appResult = await db.query(
      `SELECT a.*, c.first_name, c.last_name, c.email, j.title as job_title, e.company_name
       FROM applications a
       LEFT JOIN candidates c ON a.candidate_id = c.id
       LEFT JOIN jobs j ON a.job_id = j.id
       LEFT JOIN employers e ON j.employer_id = e.id
       WHERE a.id = $1 AND j.employer_id = $2`,
      [applicationId, req.employerId]
    );
    
    if (appResult.rows.length === 0) {
      return res.status(404).json({ error: 'Application not found' });
    }
    
    const application = appResult.rows[0];
    const candidateName = `${application.first_name} ${application.last_name}`;
    
    // Create offer record
    const offerResult = await db.query(
      `INSERT INTO offers (
        application_id, salary_amount, salary_currency, start_date,
        position_title, employment_type, benefits, additional_notes,
        status, extended_at, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', NOW(), NOW(), NOW())
      RETURNING *`,
      [
        applicationId,
        salaryAmount,
        salaryCurrency,
        startDate,
        positionTitle || application.job_title,
        employmentType,
        benefits,
        additionalNotes
      ]
    );
    
    const offer = offerResult.rows[0];
    
    // Update application status
    await db.query(
      `UPDATE applications
       SET status = 'offer_extended',
           offer_extended_at = NOW(),
           offer_details = $1,
           updated_at = NOW()
       WHERE id = $2`,
      [JSON.stringify(offer), applicationId]
    );
    
    console.log('✅ Offer created and application updated');
    
    // Format salary for email
    const formattedSalary = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: salaryCurrency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(salaryAmount);
    
    const formattedStartDate = startDate ? new Date(startDate).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }) : 'To be determined';
    
    // Send offer email
    await emailService.sendEmail(
      application.email,
      `🎊 Job Offer - ${positionTitle || application.job_title} at ${application.company_name}`,
      `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f9f9f9; padding: 20px;">
          <div style="background: linear-gradient(135deg, #16A34A, #15803D); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 32px;">🎊 Congratulations!</h1>
            <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0; font-size: 16px;">We're excited to extend you an offer</p>
          </div>
          
          <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px;">
            <p style="font-size: 16px; color: #333;">Dear ${candidateName},</p>
            
            <p style="font-size: 15px; color: #555; line-height: 1.6;">
              We are thrilled to offer you the position of <strong>${positionTitle || application.job_title}</strong> at <strong>${application.company_name}</strong>!
            </p>
            
            <div style="background: #F0FDF4; border: 2px solid #16A34A; border-radius: 12px; padding: 20px; margin: 25px 0;">
              <h3 style="margin: 0 0 15px; color: #15803D; font-size: 18px;">📋 Offer Details</h3>
              
              <div style="display: grid; gap: 12px;">
                <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #D1FAE5;">
                  <span style="color: #666; font-weight: 600;">Position:</span>
                  <span style="color: #333; font-weight: 700;">${positionTitle || application.job_title}</span>
                </div>
                
                <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #D1FAE5;">
                  <span style="color: #666; font-weight: 600;">Salary:</span>
                  <span style="color: #16A34A; font-weight: 700; font-size: 18px;">${formattedSalary}</span>
                </div>
                
                <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #D1FAE5;">
                  <span style="color: #666; font-weight: 600;">Employment Type:</span>
                  <span style="color: #333; font-weight: 700; text-transform: capitalize;">${employmentType || 'Full-time'}</span>
                </div>
                
                <div style="display: flex; justify-content: space-between; padding: 8px 0;">
                  <span style="color: #666; font-weight: 600;">Start Date:</span>
                  <span style="color: #333; font-weight: 700;">${formattedStartDate}</span>
                </div>
              </div>
            </div>
            
            ${benefits ? `
            <div style="background: #FFF8EC; border-left: 4px solid #FBB03B; padding: 15px; margin: 20px 0;">
              <h4 style="margin: 0 0 10px; color: #C47F00;">🎁 Benefits Package</h4>
              <p style="margin: 0; color: #666; white-space: pre-line;">${benefits}</p>
            </div>
            ` : ''}
            
            ${additionalNotes ? `
            <div style="background: #F5F5F5; border-radius: 8px; padding: 15px; margin: 20px 0;">
              <h4 style="margin: 0 0 10px; color: #333;">📝 Additional Information</h4>
              <p style="margin: 0; color: #666; white-space: pre-line;">${additionalNotes}</p>
            </div>
            ` : ''}
            
            <div style="background: #EFF6FF; border-left: 4px solid #2563EB; padding: 15px; margin: 20px 0;">
              <p style="margin: 0; color: #1E40AF; font-weight: 600;">
                📞 Next Steps: Our HR team will contact you within 24-48 hours to discuss the offer details and answer any questions you may have.
              </p>
            </div>
            
            <p style="font-size: 15px; color: #555; line-height: 1.6;">
              We're excited about the possibility of you joining our team and look forward to hearing from you soon!
            </p>
            
            <p style="font-size: 15px; color: #333; margin-top: 30px;">
              Warm regards,<br>
              <strong>${application.company_name} Hiring Team</strong>
            </p>
          </div>
          
          <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
            <p>This is an automated message from HireFlow ATS</p>
          </div>
        </div>
      `,
      application.company_name
    );
    
    console.log('✅ Offer email sent successfully');
    
    res.json({
      success: true,
      offer,
      message: 'Offer extended successfully'
    });
  } catch (error) {
    console.error('❌ Extend offer error:', error);
    res.status(500).json({ error: 'Failed to extend offer' });
  }
});

// Get offer by application ID (authenticated)
router.get('/application/:applicationId', authMiddleware, async (req, res) => {
  const db = req.app.locals.db;
  
  try {
    const result = await db.query(
      `SELECT o.* FROM offers o
       LEFT JOIN applications a ON o.application_id = a.id
       LEFT JOIN jobs j ON a.job_id = j.id
       WHERE o.application_id = $1 AND j.employer_id = $2
       ORDER BY o.created_at DESC
       LIMIT 1`,
      [req.params.applicationId, req.employerId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Offer not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get offer error:', error);
    res.status(500).json({ error: 'Failed to fetch offer' });
  }
});

// Update offer status (authenticated)
router.patch('/:offerId/status', authMiddleware, async (req, res) => {
  const db = req.app.locals.db;
  const { status } = req.body; // accepted, rejected, withdrawn
  
  try {
    const result = await db.query(
      `UPDATE offers o
       SET status = $1, responded_at = NOW(), updated_at = NOW()
       FROM applications a
       LEFT JOIN jobs j ON a.job_id = j.id
       WHERE o.id = $2 AND o.application_id = a.id AND j.employer_id = $3
       RETURNING o.*`,
      [status, req.params.offerId, req.employerId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Offer not found' });
    }
    
    // Update application status if offer accepted
    if (status === 'accepted') {
      await db.query(
        `UPDATE applications
         SET offer_accepted_at = NOW(), updated_at = NOW()
         WHERE id = $1`,
        [result.rows[0].application_id]
      );
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update offer status error:', error);
    res.status(500).json({ error: 'Failed to update offer' });
  }
});

module.exports = router;
