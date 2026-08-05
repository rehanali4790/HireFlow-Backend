require('dotenv').config();
const nodemailer = require('nodemailer');

async function testEmailConfig() {
  console.log('🔍 Testing email configuration...\n');
  
  console.log('Current settings:');
  console.log(`SMTP Host: ${process.env.SMTP_HOST}`);
  console.log(`SMTP Port: ${process.env.SMTP_PORT}`);
  console.log(`SMTP User: ${process.env.SMTP_USER}`);
  console.log(`SMTP Password: ${process.env.SMTP_PASSWORD ? '***' + process.env.SMTP_PASSWORD.slice(-4) : 'NOT SET'}`);
  console.log('');

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
  });

  try {
    console.log('📧 Verifying SMTP connection...');
    await transporter.verify();
    console.log('✅ SMTP connection successful!');
    console.log('');
    
    console.log('📨 Sending test email...');
    const info = await transporter.sendMail({
      from: `"${process.env.SMTP_FROM_NAME}" <${process.env.SMTP_FROM_EMAIL}>`,
      to: process.env.SMTP_USER,
      subject: 'Test Email - HireFlow Configuration',
      html: '<h1>Success!</h1><p>Your email configuration is working correctly.</p>',
    });
    
    console.log('✅ Test email sent successfully!');
    console.log(`Message ID: ${info.messageId}`);
  } catch (error) {
    console.error('❌ Email configuration error:');
    console.error(error.message);
    console.log('');
    console.log('📋 Troubleshooting steps:');
    console.log('1. Go to https://myaccount.google.com/apppasswords');
    console.log('2. Generate a new App Password for "Mail"');
    console.log('3. Update SMTP_PASSWORD in your .env file');
    console.log('4. Make sure 2-Step Verification is enabled on your Google account');
  }
}

testEmailConfig();
