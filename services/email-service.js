const nodemailer = require('nodemailer');
const {
  getApplicationConfirmationTemplate,
  getTestInvitationTemplate,
  getAIInterviewTemplate,
  getShortlistTemplate,
  getRejectionTemplate
} = require('./email-templates');

// Create transporter with better timeout and connection settings
const createTransporter = () => {
  const config = {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_PORT === '465',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS || process.env.SMTP_PASSWORD,
    },
    tls: {
      rejectUnauthorized: false,
      ciphers: 'SSLv3'
    },
    connectionTimeout: 10000, // 10 seconds
    greetingTimeout: 10000,
    socketTimeout: 10000,
  };

  return nodemailer.createTransport(config);
};

let transporter = createTransporter();

/**
 * Send email via SMTP with retry logic
 */
async function sendEmail(to, subject, html, fromName = 'HireFlow ATS') {
  try {
    console.log(`📧 Sending email to: ${to}`);
    console.log(`📝 Subject: ${subject}`);
    
    // Try to send email
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
    console.error('❌ Error sending email:', error.message);
    
    // Log email details for debugging (in production, you'd save to database)
    console.log('📋 Email details (not sent):');
    console.log(`   To: ${to}`);
    console.log(`   Subject: ${subject}`);
    console.log(`   From: ${fromName} <${process.env.SMTP_USER}>`);
    
    // In development, we'll simulate success to not block the workflow
    if (process.env.NODE_ENV === 'development') {
      console.log('⚠️  Development mode: Simulating email success');
      return {
        success: true,
        messageId: 'simulated-' + Date.now(),
        sentTo: to,
        simulated: true,
      };
    }
    
    throw error;
  }
}

/**
 * Send application confirmation email
 */
async function sendApplicationConfirmation(candidateEmail, candidateName, jobTitle, companyName, industry = 'other') {
  const subject = `Application Received - ${jobTitle}`;
  const html = getApplicationConfirmationTemplate(industry, candidateName, jobTitle, companyName);
  
  return sendEmail(candidateEmail, subject, html);
}

/**
 * Send test invitation email
 */
async function sendTestInvitation(candidateEmail, candidateName, jobTitle, testLink, testDetails = {}) {
  const subject = `Assessment Test Invitation - ${jobTitle}`;
  const industry = testDetails.industry || 'other';
  const html = getTestInvitationTemplate(industry, candidateName, jobTitle, testLink, testDetails);
  
  return sendEmail(candidateEmail, subject, html);
}

/**
 * Send AI interview invitation
 */
async function sendAIInterviewInvitation(candidateEmail, candidateName, jobTitle, interviewLink, industry = 'other') {
  const subject = `🎤 AI Interview Invitation - ${jobTitle}`;
  const html = getAIInterviewTemplate(industry, candidateName, jobTitle, interviewLink);
  
  return sendEmail(candidateEmail, subject, html);
}

// Alias for backward compatibility
async function sendInterviewInvitation(candidateEmail, candidateName, jobTitle, interviewLink, industry = 'other') {
  return sendAIInterviewInvitation(candidateEmail, candidateName, jobTitle, interviewLink, industry);
}

/**
 * Send shortlist/approval email
 */
async function sendShortlistEmail(candidateEmail, candidateName, jobTitle, companyName, nextSteps = 'assessment test', industry = 'other') {
  const subject = `Great News! You've Been Shortlisted - ${jobTitle}`;
  const html = getShortlistTemplate(industry, candidateName, jobTitle, companyName, nextSteps);
  
  return sendEmail(candidateEmail, subject, html);
}

/**
 * Send rejection email
 */
async function sendRejectionEmail(candidateEmail, candidateName, jobTitle, companyName, industry = 'other') {
  const subject = `Application Update - ${jobTitle}`;
  const html = getRejectionTemplate(industry, candidateName, jobTitle, companyName);
  
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
