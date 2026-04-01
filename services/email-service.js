const nodemailer = require('nodemailer');

// Create transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_PORT === '465', // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS || process.env.SMTP_PASSWORD,
  },
  tls: {
    rejectUnauthorized: false // Allow self-signed certificates in development
  }
});

/**
 * Send email via SMTP
 */
async function sendEmail(to, subject, html, fromName = 'HireFlow ATS') {
  try {
    console.log(`📧 Sending email to: ${to}`);
    console.log(`📝 Subject: ${subject}`);
    
    const info = await transporter.sendMail({
      from: `${fromName} <${process.env.SMTP_USER}>`,
      to,
      subject,
      html,
    });

    console.log(`✅ Email sent successfully to: ${to}`);
    
    return {
      success: true,
      messageId: info.messageId,
      sentTo: to,
    };
  } catch (error) {
    console.error('❌ Error sending email:', error);
    throw error;
  }
}

/**
 * Send application confirmation email
 */
async function sendApplicationConfirmation(candidateEmail, candidateName, jobTitle, companyName) {
  const subject = `Application Received - ${jobTitle}`;
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #4F46E5; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background: #f9f9f9; }
        .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Application Received!</h1>
        </div>
        <div class="content">
          <p>Dear ${candidateName},</p>
          <p>Thank you for applying to the <strong>${jobTitle}</strong> position at <strong>${companyName}</strong>.</p>
          <p>We have received your application and our team will review it shortly. You will hear from us soon regarding the next steps.</p>
          <p>Best regards,<br>${companyName} Hiring Team</p>
        </div>
        <div class="footer">
          <p>This is an automated message from HireFlow ATS</p>
        </div>
      </div>
    </body>
    </html>
  `;
  
  return sendEmail(candidateEmail, subject, html);
}

/**
 * Send test invitation email
 */
async function sendTestInvitation(candidateEmail, candidateName, jobTitle, testLink, testDetails = {}) {
  const {
    duration,
    questionCount,
    passingScore,
    expiryDays = 7,
    testType = 'Multiple Choice Questions (MCQs)'
  } = testDetails;
  
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + expiryDays);
  
  const subject = `Assessment Test Invitation - ${jobTitle}`;
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #4F46E5; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background: #f9f9f9; }
        .test-details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border: 2px solid #4F46E5; }
        .detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #E5E7EB; }
        .detail-label { font-weight: bold; color: #4F46E5; }
        .button { display: inline-block; padding: 15px 30px; background: #4F46E5; color: white; text-decoration: none; border-radius: 8px; margin: 20px 0; font-weight: bold; }
        .warning { background: #FEF3C7; padding: 15px; border-left: 4px solid #F59E0B; margin: 20px 0; }
        .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>📝 Assessment Test Invitation</h1>
        </div>
        <div class="content">
          <p>Dear ${candidateName},</p>
          <p>Congratulations! You have been invited to take the assessment test for the <strong>${jobTitle}</strong> position.</p>
          
          <div class="test-details">
            <h3 style="margin-top: 0; color: #4F46E5;">Test Details</h3>
            <div class="detail-row">
              <span class="detail-label">Test Type:</span>
              <span>${testType}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Number of Questions:</span>
              <span>${questionCount} questions</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Duration:</span>
              <span>${duration} minutes</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Passing Score:</span>
              <span>${passingScore}%</span>
            </div>
            <div class="detail-row" style="border-bottom: none;">
              <span class="detail-label">Valid Until:</span>
              <span>${expiryDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
            </div>
          </div>
          
          <div class="warning">
            <strong>⚠️ Important Notes:</strong>
            <ul style="margin: 10px 0;">
              <li>The test link expires in <strong>${expiryDays} days</strong></li>
              <li>You can only attempt the test <strong>once</strong></li>
              <li>Ensure you have a stable internet connection</li>
              <li>Complete the test in one sitting - you cannot pause</li>
            </ul>
          </div>
          
          <p style="text-align: center;">
            <a href="${testLink}" class="button">Start Test Now</a>
          </p>
          
          <p><strong>Tips for Success:</strong></p>
          <ul>
            <li>Find a quiet place without distractions</li>
            <li>Read each question carefully before answering</li>
            <li>Manage your time wisely</li>
            <li>Review your answers if time permits</li>
          </ul>
          
          <p>Good luck! We're excited to see your performance.</p>
        </div>
        <div class="footer">
          <p>This is an automated message from HireFlow ATS</p>
          <p>If you have any technical issues, please contact support immediately.</p>
        </div>
      </div>
    </body>
    </html>
  `;
  
  return sendEmail(candidateEmail, subject, html);
}

/**
 * Send AI interview invitation
 */
async function sendInterviewInvitation(candidateEmail, candidateName, jobTitle, interviewLink) {
  const subject = `AI Interview Invitation - ${jobTitle}`;
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #4F46E5; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background: #f9f9f9; }
        .button { display: inline-block; padding: 12px 24px; background: #4F46E5; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>AI Interview Invitation</h1>
        </div>
        <div class="content">
          <p>Dear ${candidateName},</p>
          <p>Great news! You have been invited to participate in an AI-powered interview for the <strong>${jobTitle}</strong> position.</p>
          <p>This interview will be conducted by our AI interviewer and will take approximately 15-20 minutes.</p>
          <p>Please click the button below to start your interview:</p>
          <p style="text-align: center;">
            <a href="${interviewLink}" class="button">Start Interview</a>
          </p>
          <p>Tips for success:</p>
          <ul>
            <li>Find a quiet place with good internet connection</li>
            <li>Be prepared to answer questions about your experience</li>
            <li>Speak clearly and provide specific examples</li>
          </ul>
          <p>Good luck!</p>
        </div>
        <div class="footer">
          <p>This is an automated message from HireFlow ATS</p>
        </div>
      </div>
    </body>
    </html>
  `;
  
  return sendEmail(candidateEmail, subject, html);
}

/**
 * Send shortlist/approval email
 */
async function sendShortlistEmail(candidateEmail, candidateName, jobTitle, companyName, nextSteps = 'assessment test') {
  const subject = `Great News! You've Been Shortlisted - ${jobTitle}`;
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #10B981; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background: #f9f9f9; }
        .highlight { background: #D1FAE5; padding: 15px; border-left: 4px solid #10B981; margin: 20px 0; }
        .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🎉 Congratulations!</h1>
        </div>
        <div class="content">
          <p>Dear ${candidateName},</p>
          <p>We're pleased to inform you that your application for the <strong>${jobTitle}</strong> position at <strong>${companyName}</strong> has been shortlisted!</p>
          
          <div class="highlight">
            <strong>What's Next?</strong><br>
            You will receive a separate email shortly with details about the next step: <strong>${nextSteps}</strong>.
          </div>
          
          <p>This is an exciting step forward in our hiring process, and we look forward to learning more about you.</p>
          
          <p>If you have any questions, please don't hesitate to reach out.</p>
          
          <p>Best regards,<br>${companyName} Hiring Team</p>
        </div>
        <div class="footer">
          <p>This is an automated message from HireFlow ATS</p>
        </div>
      </div>
    </body>
    </html>
  `;
  
  return sendEmail(candidateEmail, subject, html);
}

/**
 * Send rejection email
 */
async function sendRejectionEmail(candidateEmail, candidateName, jobTitle, companyName) {
  const subject = `Application Update - ${jobTitle}`;
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #4F46E5; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background: #f9f9f9; }
        .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Application Update</h1>
        </div>
        <div class="content">
          <p>Dear ${candidateName},</p>
          <p>Thank you for your interest in the <strong>${jobTitle}</strong> position at <strong>${companyName}</strong>.</p>
          <p>After careful consideration, we have decided to move forward with other candidates whose qualifications more closely match our current needs.</p>
          <p>We appreciate the time you invested in the application process and wish you the best in your job search.</p>
          <p>Best regards,<br>${companyName} Hiring Team</p>
        </div>
        <div class="footer">
          <p>This is an automated message from HireFlow ATS</p>
        </div>
      </div>
    </body>
    </html>
  `;
  
  return sendEmail(candidateEmail, subject, html);
}

module.exports = {
  sendEmail,
  sendApplicationConfirmation,
  sendTestInvitation,
  sendInterviewInvitation,
  sendShortlistEmail,
  sendRejectionEmail,
};
