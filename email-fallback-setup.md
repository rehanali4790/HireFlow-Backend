# Email Configuration Troubleshooting

## Current Issue
Your network is blocking connections to Gmail's SMTP server (port 587).

## Quick Fix Options

### Option 1: Use Port 465 (SSL) Instead of 587 (TLS)
Update your `.env` file:
```env
SMTP_PORT=465
```

### Option 2: Check Firewall/Antivirus
- Temporarily disable Windows Firewall
- Disable antivirus email scanning
- Check if your ISP blocks port 587

### Option 3: Use Mailtrap (Recommended for Development)
1. Sign up at https://mailtrap.io (free)
2. Get credentials from your inbox
3. Update `.env`:
```env
SMTP_HOST=sandbox.smtp.mailtrap.io
SMTP_PORT=2525
SMTP_USER=your_mailtrap_username
SMTP_PASSWORD=your_mailtrap_password
SMTP_FROM_EMAIL=noreply@hireflow.com
```

### Option 4: Use SendGrid (Production Ready)
1. Sign up at https://sendgrid.com (free tier: 100 emails/day)
2. Create API key
3. Update `.env`:
```env
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASSWORD=your_sendgrid_api_key
SMTP_FROM_EMAIL=your_verified_email@domain.com
```

### Option 5: Development Mode (Current Setup)
The system now simulates email success in development mode.
Emails won't actually send, but the application will continue working.

Check console logs to see email content that would have been sent.

## Testing Email Configuration

Run this command to test:
```bash
node test-email-config.js
```

## Network Troubleshooting

### Test if port 587 is blocked:
```bash
telnet smtp.gmail.com 587
```

If it times out, port 587 is blocked by your network/firewall.

### Test if port 465 works:
```bash
telnet smtp.gmail.com 465
```

## Recommended Solution for Your Case

Since you're getting ETIMEDOUT errors, I recommend:

1. **For Development**: Use Mailtrap (easiest, no network issues)
2. **For Production**: Use SendGrid or AWS SES (reliable, scalable)

Both services work over HTTP/HTTPS, avoiding firewall issues with SMTP ports.
