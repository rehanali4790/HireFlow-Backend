import emailService from '../lib/email-service.js';
import dotenv from 'dotenv';

dotenv.config();

async function testEmail() {
  console.log('🧪 Testing email service...\n');

  // Test basic email
  console.log('📧 Sending test email...');
  const result = await emailService.sendEmail({
    to: process.env.TEST_EMAIL || 'test@example.com',
    subject: 'HireFlow Email Test',
    html: '<h1>Email Service Working!</h1><p>This is a test email from HireFlow.</p>',
    candidateId: '00000000-0000-0000-0000-000000000000',
    emailType: 'test',
  });

  if (result.success) {
    console.log('✅ Test email sent successfully!');
    console.log('   Message ID:', result.messageId);
  } else {
    console.error('❌ Test email failed:', result.error);
  }
}

testEmail();
