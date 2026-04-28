require('dotenv').config();
const nodemailer = require('nodemailer');

async function testEmail() {
  console.log('📧 Testing Email Configuration\n');
  
  console.log('Configuration:');
  console.log('  SMTP_HOST:', process.env.SMTP_HOST);
  console.log('  SMTP_PORT:', process.env.SMTP_PORT);
  console.log('  SMTP_USER:', process.env.SMTP_USER);
  console.log('  SMTP_PASSWORD:', process.env.SMTP_PASSWORD ? '✅ Set' : '❌ Not set');
  console.log('');
  
  // Create transporter
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_PORT === '465',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
    tls: {
      rejectUnauthorized: false
    }
  });
  
  try {
    // Verify connection
    console.log('🔄 Verifying SMTP connection...');
    await transporter.verify();
    console.log('✅ SMTP connection verified!\n');
    
    // Send test email
    console.log('📤 Sending test email...');
    const info = await transporter.sendMail({
      from: `HireFlow Test <${process.env.SMTP_USER}>`,
      to: process.env.SMTP_USER, // Send to yourself
      subject: '✅ HireFlow Email Test - Success!',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px;">
            <h1>✅ Email Configuration Working!</h1>
          </div>
          <div style="padding: 30px; background: #f9f9f9; margin-top: 20px; border-radius: 10px;">
            <p>Great news! Your HireFlow email configuration is working correctly.</p>
            <p><strong>Configuration Details:</strong></p>
            <ul>
              <li>SMTP Host: ${process.env.SMTP_HOST}</li>
              <li>SMTP Port: ${process.env.SMTP_PORT}</li>
              <li>SMTP User: ${process.env.SMTP_USER}</li>
            </ul>
            <p>You can now send:</p>
            <ul>
              <li>✅ Application confirmations</li>
              <li>✅ Test invitations</li>
              <li>✅ AI interview invitations</li>
              <li>✅ Shortlist notifications</li>
              <li>✅ Rejection emails</li>
            </ul>
            <p style="margin-top: 30px; padding-top: 20px; border-top: 2px solid #ddd;">
              <small>This is a test email from HireFlow ATS</small>
            </p>
          </div>
        </div>
      `
    });
    
    console.log('✅ Test email sent successfully!');
    console.log('📬 Message ID:', info.messageId);
    console.log('📧 Check your inbox:', process.env.SMTP_USER);
    console.log('');
    console.log('🎉 Email configuration is working correctly!');
    
  } catch (error) {
    console.error('❌ Email test failed:', error.message);
    console.log('');
    console.log('🔧 Troubleshooting:');
    
    if (error.code === 'EAUTH') {
      console.log('  ❌ Authentication failed');
      console.log('  📝 Solutions:');
      console.log('     1. Enable "Less secure app access" in Gmail settings');
      console.log('     2. OR use an App Password:');
      console.log('        - Go to: https://myaccount.google.com/apppasswords');
      console.log('        - Generate an App Password');
      console.log('        - Use that password in SMTP_PASSWORD');
    } else if (error.code === 'ECONNECTION') {
      console.log('  ❌ Connection failed');
      console.log('  📝 Check your internet connection and firewall');
    } else {
      console.log('  Error code:', error.code);
      console.log('  Error details:', error);
    }
  }
}

testEmail();
