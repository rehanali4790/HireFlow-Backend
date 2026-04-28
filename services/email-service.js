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
async function sendAIInterviewInvitation(candidateEmail, candidateName, jobTitle, interviewLink) {
  const subject = `🎤 AI Interview Invitation - ${jobTitle}`;
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; }
        .content { padding: 30px; background: #f9f9f9; }
        .interview-details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border: 2px solid #667eea; }
        .detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #E5E7EB; }
        .detail-label { font-weight: bold; color: #667eea; }
        .button { display: inline-block; padding: 15px 40px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; border-radius: 8px; margin: 20px 0; font-weight: bold; font-size: 16px; }
        .warning { background: #FEF3C7; padding: 15px; border-left: 4px solid #F59E0B; margin: 20px 0; }
        .tips { background: #DBEAFE; padding: 15px; border-left: 4px solid #3B82F6; margin: 20px 0; }
        .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🎤 AI Interview Invitation</h1>
          <p style="margin: 10px 0 0 0; font-size: 18px;">You're one step closer!</p>
        </div>
        <div class="content">
          <p>Dear ${candidateName},</p>
          <p>Congratulations! You have been selected to participate in an AI-powered interview for the <strong>${jobTitle}</strong> position.</p>
          
          <div class="interview-details">
            <h3 style="margin-top: 0; color: #667eea;">Interview Details</h3>
            <div class="detail-row">
              <span class="detail-label">Format:</span>
              <span>AI-Powered Voice Interview</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Duration:</span>
              <span>15-20 minutes</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Questions:</span>
              <span>8-10 questions based on your resume and job requirements</span>
            </div>
            <div class="detail-row" style="border-bottom: none;">
              <span class="detail-label">Technology:</span>
              <span>Voice-based (microphone required)</span>
            </div>
          </div>
          
          <div class="warning">
            <strong>⚠️ Technical Requirements:</strong>
            <ul style="margin: 10px 0;">
              <li><strong>Microphone:</strong> Required for voice responses</li>
              <li><strong>Camera:</strong> Recommended (optional)</li>
              <li><strong>Browser:</strong> Chrome or Edge (latest version)</li>
              <li><strong>Internet:</strong> Stable connection required</li>
            </ul>
          </div>
          
          <p style="text-align: center;">
            <a href="${interviewLink}" class="button">Start AI Interview</a>
          </p>
          
          <div class="tips">
            <strong>💡 Tips for Success:</strong>
            <ul style="margin: 10px 0;">
              <li><strong>Environment:</strong> Find a quiet place without background noise</li>
              <li><strong>Preparation:</strong> Review your resume and the job description</li>
              <li><strong>Communication:</strong> Speak clearly and provide specific examples</li>
              <li><strong>Honesty:</strong> Be genuine - the AI evaluates authenticity</li>
              <li><strong>Details:</strong> Provide concrete examples from your experience</li>
            </ul>
          </div>
          
          <h3>How It Works:</h3>
          <ol>
            <li>Click the "Start AI Interview" button above</li>
            <li>Grant microphone (and camera) permissions</li>
            <li>The AI interviewer will welcome you and ask questions</li>
            <li>Listen to each question and respond naturally</li>
            <li>The interview will automatically end after all questions</li>
          </ol>
          
          <p><strong>Note:</strong> The AI will ask questions based 60% on your resume and 40% on the job requirements, ensuring a personalized interview experience.</p>
          
          <p>Good luck! We're excited to learn more about you.</p>
          
          <p>Best regards,<br>The Hiring Team</p>
        </div>
        <div class="footer">
          <p>This is an automated message from HireFlow ATS</p>
          <p>If you experience technical issues, please contact support immediately.</p>
        </div>
      </div>
    </body>
    </html>
  `;
  
  return sendEmail(candidateEmail, subject, html);
}

// Alias for backward compatibility
async function sendInterviewInvitation(candidateEmail, candidateName, jobTitle, interviewLink) {
  return sendAIInterviewInvitation(candidateEmail, candidateName, jobTitle, interviewLink);
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
  sendAIInterviewInvitation,
  sendInterviewInvitation,
  sendShortlistEmail,
  sendRejectionEmail,
};
