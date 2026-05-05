/**
 * Industry-specific email templates for HireFlow
 * Each template is customized for different industries while maintaining the same core content
 */

const industryTemplates = {
  technology: {
    colors: {
      primary: '#4F46E5',
      secondary: '#818CF8',
      gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      accent: '#10B981'
    },
    style: 'modern',
    tone: 'innovative'
  },
  healthcare: {
    colors: {
      primary: '#0EA5E9',
      secondary: '#38BDF8',
      gradient: 'linear-gradient(135deg, #0EA5E9 0%, #06B6D4 100%)',
      accent: '#10B981'
    },
    style: 'professional',
    tone: 'caring'
  },
  finance: {
    colors: {
      primary: '#1E40AF',
      secondary: '#3B82F6',
      gradient: 'linear-gradient(135deg, #1E40AF 0%, #3B82F6 100%)',
      accent: '#059669'
    },
    style: 'corporate',
    tone: 'professional'
  },
  education: {
    colors: {
      primary: '#7C3AED',
      secondary: '#A78BFA',
      gradient: 'linear-gradient(135deg, #7C3AED 0%, #A78BFA 100%)',
      accent: '#10B981'
    },
    style: 'friendly',
    tone: 'encouraging'
  },
  retail: {
    colors: {
      primary: '#DC2626',
      secondary: '#F87171',
      gradient: 'linear-gradient(135deg, #DC2626 0%, #F97316 100%)',
      accent: '#10B981'
    },
    style: 'vibrant',
    tone: 'energetic'
  },
  manufacturing: {
    colors: {
      primary: '#475569',
      secondary: '#64748B',
      gradient: 'linear-gradient(135deg, #475569 0%, #64748B 100%)',
      accent: '#10B981'
    },
    style: 'industrial',
    tone: 'straightforward'
  },
  consulting: {
    colors: {
      primary: '#0F766E',
      secondary: '#14B8A6',
      gradient: 'linear-gradient(135deg, #0F766E 0%, #14B8A6 100%)',
      accent: '#10B981'
    },
    style: 'sophisticated',
    tone: 'strategic'
  },
  other: {
    colors: {
      primary: '#4F46E5',
      secondary: '#818CF8',
      gradient: 'linear-gradient(135deg, #4F46E5 0%, #818CF8 100%)',
      accent: '#10B981'
    },
    style: 'modern',
    tone: 'professional'
  }
};

/**
 * Get base email styles for an industry
 */
function getIndustryStyles(industry = 'other') {
  const template = industryTemplates[industry] || industryTemplates.other;
  
  return `
    <style>
      body { 
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
        line-height: 1.6; 
        color: #1F2937;
        margin: 0;
        padding: 0;
        background-color: #F3F4F6;
      }
      .email-wrapper {
        max-width: 600px;
        margin: 0 auto;
        background-color: #F3F4F6;
        padding: 20px;
      }
      .email-container { 
        max-width: 600px; 
        margin: 0 auto; 
        background: white;
        border-radius: 12px;
        overflow: hidden;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      }
      .email-header { 
        background: ${template.colors.gradient};
        color: white; 
        padding: 40px 30px; 
        text-align: center;
      }
      .email-header h1 {
        margin: 0;
        font-size: 28px;
        font-weight: 700;
      }
      .email-header p {
        margin: 10px 0 0 0;
        font-size: 16px;
        opacity: 0.95;
      }
      .email-content { 
        padding: 40px 30px; 
        background: white;
      }
      .email-content p {
        margin: 0 0 16px 0;
        color: #374151;
        font-size: 15px;
      }
      .email-content strong {
        color: ${template.colors.primary};
        font-weight: 600;
      }
      .details-box { 
        background: #F9FAFB; 
        padding: 24px; 
        border-radius: 8px; 
        margin: 24px 0; 
        border: 2px solid ${template.colors.primary};
        border-left: 6px solid ${template.colors.primary};
      }
      .details-box h3 {
        margin: 0 0 16px 0;
        color: ${template.colors.primary};
        font-size: 18px;
        font-weight: 600;
      }
      .detail-row { 
        display: flex; 
        justify-content: space-between; 
        padding: 12px 0; 
        border-bottom: 1px solid #E5E7EB;
      }
      .detail-row:last-child {
        border-bottom: none;
      }
      .detail-label { 
        font-weight: 600; 
        color: ${template.colors.primary};
      }
      .detail-value {
        color: #374151;
        text-align: right;
      }
      .cta-button { 
        display: inline-block; 
        padding: 16px 40px; 
        background: ${template.colors.gradient};
        color: white !important; 
        text-decoration: none; 
        border-radius: 8px; 
        margin: 24px 0; 
        font-weight: 600;
        font-size: 16px;
        text-align: center;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      }
      .cta-button:hover {
        opacity: 0.9;
      }
      .warning-box { 
        background: #FEF3C7; 
        padding: 20px; 
        border-left: 4px solid #F59E0B; 
        margin: 24px 0;
        border-radius: 4px;
      }
      .warning-box strong {
        color: #92400E;
      }
      .warning-box ul {
        margin: 12px 0 0 0;
        padding-left: 20px;
      }
      .warning-box li {
        color: #78350F;
        margin: 6px 0;
      }
      .info-box { 
        background: #DBEAFE; 
        padding: 20px; 
        border-left: 4px solid #3B82F6; 
        margin: 24px 0;
        border-radius: 4px;
      }
      .info-box strong {
        color: #1E40AF;
      }
      .success-box {
        background: #D1FAE5;
        padding: 20px;
        border-left: 4px solid ${template.colors.accent};
        margin: 24px 0;
        border-radius: 4px;
      }
      .success-box strong {
        color: #065F46;
      }
      .email-footer { 
        padding: 30px; 
        text-align: center; 
        background: #F9FAFB;
        border-top: 1px solid #E5E7EB;
      }
      .email-footer p {
        margin: 8px 0;
        font-size: 13px;
        color: #6B7280;
      }
      .email-footer a {
        color: ${template.colors.primary};
        text-decoration: none;
      }
      ul {
        margin: 16px 0;
        padding-left: 24px;
      }
      li {
        margin: 8px 0;
        color: #374151;
      }
      .divider {
        height: 1px;
        background: #E5E7EB;
        margin: 24px 0;
      }
    </style>
  `;
}

/**
 * Application Confirmation Template
 */
function getApplicationConfirmationTemplate(industry, candidateName, jobTitle, companyName) {
  const styles = getIndustryStyles(industry);
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      ${styles}
    </head>
    <body>
      <div class="email-wrapper">
        <div class="email-container">
          <div class="email-header">
            <h1>✓ Application Received</h1>
            <p>We've received your application</p>
          </div>
          <div class="email-content">
            <p>Dear ${candidateName},</p>
            <p>Thank you for applying to the <strong>${jobTitle}</strong> position at <strong>${companyName}</strong>.</p>
            
            <div class="success-box">
              <strong>✓ Your application has been successfully submitted</strong>
              <p style="margin: 8px 0 0 0; color: #065F46;">Our hiring team will carefully review your qualifications and experience.</p>
            </div>
            
            <p><strong>What happens next?</strong></p>
            <ul>
              <li>Our team will review your application within 3-5 business days</li>
              <li>If your profile matches our requirements, we'll contact you for the next steps</li>
              <li>You'll receive email updates about your application status</li>
            </ul>
            
            <div class="divider"></div>
            
            <p>We appreciate your interest in joining our team and wish you the best in the selection process.</p>
            
            <p style="margin-top: 32px;">Best regards,<br><strong>${companyName} Hiring Team</strong></p>
          </div>
          <div class="email-footer">
            <p><strong>HireFlow ATS</strong> - Automated Hiring System</p>
            <p>This is an automated message. Please do not reply to this email.</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Test Invitation Template
 */
function getTestInvitationTemplate(industry, candidateName, jobTitle, testLink, testDetails = {}) {
  const styles = getIndustryStyles(industry);
  const {
    duration = 30,
    questionCount = 20,
    passingScore = 70,
    expiryDays = 7,
    testType = 'Multiple Choice Questions (MCQs)'
  } = testDetails;
  
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + expiryDays);
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      ${styles}
    </head>
    <body>
      <div class="email-wrapper">
        <div class="email-container">
          <div class="email-header">
            <h1>📝 Assessment Test Invitation</h1>
            <p>You've been selected for the next stage</p>
          </div>
          <div class="email-content">
            <p>Dear ${candidateName},</p>
            <p>Congratulations! You have been invited to take the assessment test for the <strong>${jobTitle}</strong> position.</p>
            
            <div class="details-box">
              <h3>📋 Test Details</h3>
              <div class="detail-row">
                <span class="detail-label">Test Type:</span>
                <span class="detail-value">${testType}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Number of Questions:</span>
                <span class="detail-value">${questionCount} questions</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Duration:</span>
                <span class="detail-value">${duration} minutes</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Passing Score:</span>
                <span class="detail-value">${passingScore}%</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Valid Until:</span>
                <span class="detail-value">${expiryDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
              </div>
            </div>
            
            <div class="warning-box">
              <strong>⚠️ Important Guidelines:</strong>
              <ul>
                <li>The test link expires in <strong>${expiryDays} days</strong></li>
                <li>You can only attempt the test <strong>once</strong></li>
                <li>Ensure you have a stable internet connection</li>
                <li>Complete the test in one sitting - you cannot pause</li>
                <li>Find a quiet environment without distractions</li>
              </ul>
            </div>
            
            <div style="text-align: center;">
              <a href="${testLink}" class="cta-button">Start Test Now →</a>
            </div>
            
            <div class="info-box">
              <strong>💡 Tips for Success:</strong>
              <ul style="margin: 12px 0 0 0; padding-left: 20px;">
                <li>Read each question carefully before answering</li>
                <li>Manage your time wisely across all questions</li>
                <li>Review your answers if time permits</li>
                <li>Trust your first instinct when unsure</li>
              </ul>
            </div>
            
            <p style="margin-top: 32px;">Good luck! We're excited to see your performance.</p>
            
            <p style="margin-top: 24px;">Best regards,<br><strong>The Hiring Team</strong></p>
          </div>
          <div class="email-footer">
            <p><strong>HireFlow ATS</strong> - Automated Hiring System</p>
            <p>If you experience technical issues, please contact support immediately.</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * AI Interview Invitation Template
 */
function getAIInterviewTemplate(industry, candidateName, jobTitle, interviewLink) {
  const styles = getIndustryStyles(industry);
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      ${styles}
    </head>
    <body>
      <div class="email-wrapper">
        <div class="email-container">
          <div class="email-header">
            <h1>🎤 AI Interview Invitation</h1>
            <p>You're one step closer to joining our team!</p>
          </div>
          <div class="email-content">
            <p>Dear ${candidateName},</p>
            <p>Congratulations! You have been selected to participate in an AI-powered interview for the <strong>${jobTitle}</strong> position.</p>
            
            <div class="details-box">
              <h3>🎯 Interview Details</h3>
              <div class="detail-row">
                <span class="detail-label">Format:</span>
                <span class="detail-value">AI-Powered Voice Interview</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Duration:</span>
                <span class="detail-value">15-20 minutes</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Questions:</span>
                <span class="detail-value">8-10 personalized questions</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Technology:</span>
                <span class="detail-value">Voice-based (microphone required)</span>
              </div>
            </div>
            
            <div class="warning-box">
              <strong>⚠️ Technical Requirements:</strong>
              <ul>
                <li><strong>Microphone:</strong> Required for voice responses</li>
                <li><strong>Camera:</strong> Recommended (optional)</li>
                <li><strong>Browser:</strong> Chrome or Edge (latest version)</li>
                <li><strong>Internet:</strong> Stable connection required</li>
              </ul>
            </div>
            
            <div style="text-align: center;">
              <a href="${interviewLink}" class="cta-button">Start AI Interview →</a>
            </div>
            
            <div class="info-box">
              <strong>💡 Tips for Success:</strong>
              <ul style="margin: 12px 0 0 0; padding-left: 20px;">
                <li><strong>Environment:</strong> Find a quiet place without background noise</li>
                <li><strong>Preparation:</strong> Review your resume and the job description</li>
                <li><strong>Communication:</strong> Speak clearly and provide specific examples</li>
                <li><strong>Authenticity:</strong> Be genuine - the AI evaluates authenticity</li>
                <li><strong>Details:</strong> Provide concrete examples from your experience</li>
              </ul>
            </div>
            
            <p><strong>How It Works:</strong></p>
            <ol>
              <li>Click the "Start AI Interview" button above</li>
              <li>Grant microphone (and camera) permissions</li>
              <li>The AI interviewer will welcome you and ask questions</li>
              <li>Listen to each question and respond naturally</li>
              <li>The interview will automatically end after all questions</li>
            </ol>
            
            <p><strong>Note:</strong> The AI will ask questions based 60% on your resume and 40% on the job requirements, ensuring a personalized interview experience.</p>
            
            <p style="margin-top: 32px;">Good luck! We're excited to learn more about you.</p>
            
            <p style="margin-top: 24px;">Best regards,<br><strong>The Hiring Team</strong></p>
          </div>
          <div class="email-footer">
            <p><strong>HireFlow ATS</strong> - Automated Hiring System</p>
            <p>If you experience technical issues, please contact support immediately.</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Shortlist Email Template
 */
function getShortlistTemplate(industry, candidateName, jobTitle, companyName, nextSteps = 'assessment test') {
  const styles = getIndustryStyles(industry);
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      ${styles}
    </head>
    <body>
      <div class="email-wrapper">
        <div class="email-container">
          <div class="email-header">
            <h1>🎉 Congratulations!</h1>
            <p>You've been shortlisted</p>
          </div>
          <div class="email-content">
            <p>Dear ${candidateName},</p>
            <p>We're pleased to inform you that your application for the <strong>${jobTitle}</strong> position at <strong>${companyName}</strong> has been shortlisted!</p>
            
            <div class="success-box">
              <strong>🌟 You've made it to the next round!</strong>
              <p style="margin: 8px 0 0 0; color: #065F46;">Your qualifications and experience have impressed our hiring team.</p>
            </div>
            
            <p><strong>What's Next?</strong></p>
            <p>You will receive a separate email shortly with details about the next step: <strong>${nextSteps}</strong>.</p>
            
            <div class="info-box">
              <strong>📅 Timeline:</strong>
              <p style="margin: 8px 0 0 0; color: #1E40AF;">Expect to hear from us within the next 24-48 hours with further instructions.</p>
            </div>
            
            <p>This is an exciting step forward in our hiring process, and we look forward to learning more about you.</p>
            
            <p>If you have any questions, please don't hesitate to reach out.</p>
            
            <p style="margin-top: 32px;">Best regards,<br><strong>${companyName} Hiring Team</strong></p>
          </div>
          <div class="email-footer">
            <p><strong>HireFlow ATS</strong> - Automated Hiring System</p>
            <p>This is an automated message. Please do not reply to this email.</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Rejection Email Template
 */
function getRejectionTemplate(industry, candidateName, jobTitle, companyName) {
  const styles = getIndustryStyles(industry);
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      ${styles}
    </head>
    <body>
      <div class="email-wrapper">
        <div class="email-container">
          <div class="email-header">
            <h1>Application Update</h1>
            <p>Regarding your application</p>
          </div>
          <div class="email-content">
            <p>Dear ${candidateName},</p>
            <p>Thank you for your interest in the <strong>${jobTitle}</strong> position at <strong>${companyName}</strong> and for taking the time to apply.</p>
            
            <p>After careful consideration of all applications, we have decided to move forward with other candidates whose qualifications more closely match our current needs for this specific role.</p>
            
            <div class="info-box">
              <strong>This decision does not reflect on your abilities or potential.</strong>
              <p style="margin: 8px 0 0 0; color: #1E40AF;">We received many strong applications, and the selection process was highly competitive.</p>
            </div>
            
            <p><strong>We encourage you to:</strong></p>
            <ul>
              <li>Keep an eye on our careers page for future opportunities</li>
              <li>Apply for other positions that match your skills and interests</li>
              <li>Connect with us on professional networks</li>
            </ul>
            
            <p>We appreciate the time and effort you invested in the application process and wish you the very best in your job search and career endeavors.</p>
            
            <p style="margin-top: 32px;">Best regards,<br><strong>${companyName} Hiring Team</strong></p>
          </div>
          <div class="email-footer">
            <p><strong>HireFlow ATS</strong> - Automated Hiring System</p>
            <p>This is an automated message. Please do not reply to this email.</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
}

module.exports = {
  industryTemplates,
  getIndustryStyles,
  getApplicationConfirmationTemplate,
  getTestInvitationTemplate,
  getAIInterviewTemplate,
  getShortlistTemplate,
  getRejectionTemplate
};
