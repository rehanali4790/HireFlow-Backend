# Email Templates Guide

## Overview

HireFlow now supports industry-specific email templates that automatically style all automated emails based on your company's industry. Each template maintains the same content while applying industry-appropriate colors, formatting, and tone.

## Features

### Industry-Specific Designs

Choose from 8 professionally designed templates:

1. **Technology** 💻
   - Modern, innovative design
   - Purple/indigo gradient colors
   - Perfect for tech startups and software companies

2. **Healthcare** 🏥
   - Professional, caring tone
   - Blue/cyan color scheme
   - Ideal for hospitals, clinics, and medical organizations

3. **Finance** 💼
   - Corporate, trustworthy style
   - Navy blue professional colors
   - Suited for banks, investment firms, and financial services

4. **Education** 🎓
   - Friendly, encouraging design
   - Purple/lavender colors
   - Great for schools, universities, and training centers

5. **Retail** 🛍️
   - Vibrant, energetic style
   - Red/orange dynamic colors
   - Perfect for stores, e-commerce, and consumer brands

6. **Manufacturing** 🏭
   - Industrial, straightforward design
   - Gray/slate professional colors
   - Ideal for factories, production facilities, and industrial companies

7. **Consulting** 📊
   - Sophisticated, strategic style
   - Teal/turquoise colors
   - Suited for consulting firms and professional services

8. **Other** 🏢
   - General professional design
   - Indigo/blue colors
   - Works for any industry not listed above

## Email Types

All email types use your selected industry template:

### 1. Application Confirmation
- Sent automatically when a candidate applies
- Confirms receipt of application
- Sets expectations for next steps

### 2. Test Invitation
- Sent when inviting candidates to assessment tests
- Includes test details (duration, questions, passing score)
- Contains secure test link with expiration

### 3. AI Interview Invitation
- Sent for AI-powered interview invitations
- Includes technical requirements
- Provides tips for success

### 4. Shortlist Notification
- Sent when a candidate is shortlisted
- Congratulatory tone
- Informs about next steps

### 5. Rejection Email
- Sent when application is not moving forward
- Professional and respectful tone
- Encourages future applications

## How to Use

### 1. Select Your Industry Template

1. Navigate to **Settings** in your dashboard
2. Click on **Email Templates** tab
3. Choose your industry from the available options
4. Click **Show Preview** to see how emails will look
5. Select different email types to preview each one
6. Click **Save Template Selection** to apply

### 2. Preview Templates

Before saving, you can preview how each email type will look:

1. Select your industry
2. Click **Show Preview**
3. Use the email type selector to view:
   - Application Confirmation
   - Test Invitation
   - AI Interview Invitation
   - Shortlist Notification
   - Rejection Email

### 3. Automatic Application

Once saved, all automated emails will use your selected template:
- No additional configuration needed
- Works immediately for all new emails
- Consistent branding across all communications

## Technical Details

### Database Schema

The email template system uses the following database structure:

```sql
-- Email templates table
CREATE TABLE email_templates (
  id uuid PRIMARY KEY,
  employer_id uuid REFERENCES employers(id),
  name text NOT NULL,
  subject text NOT NULL,
  body text NOT NULL,
  template_type text NOT NULL,
  industry text DEFAULT 'general',
  is_default boolean DEFAULT false,
  template_category text,
  created_at timestamptz,
  updated_at timestamptz
);
```

### Template Variables

Templates support dynamic content through variables:

- `[Candidate Name]` - Candidate's full name
- `[Job Title]` - Position title
- `[Company Name]` - Your company name
- `[Test Link]` - Secure test URL
- `[Interview Link]` - Secure interview URL
- `[Duration]` - Test/interview duration
- `[Questions]` - Number of questions
- `[Passing Score]` - Required score percentage

### Color Schemes

Each industry has a carefully selected color palette:

```javascript
{
  technology: {
    primary: '#4F46E5',
    gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
  },
  healthcare: {
    primary: '#0EA5E9',
    gradient: 'linear-gradient(135deg, #0EA5E9 0%, #06B6D4 100%)'
  },
  // ... other industries
}
```

## Migration

To enable email templates in your existing HireFlow installation:

```bash
# Run the migration script
node run-email-template-migration.js
```

This will:
- Add industry column to email_templates table
- Add template_category column
- Add is_default column for system templates
- Create necessary indexes

## API Integration

### Backend Service

The email service automatically uses the employer's industry:

```javascript
// Email service automatically fetches industry
await emailService.sendApplicationConfirmation(
  candidateEmail,
  candidateName,
  jobTitle,
  companyName,
  industry  // Fetched from employer profile
);
```

### Routes

All email-sending routes have been updated to include industry:

```javascript
// Get employer industry
const employerResult = await db.query(
  'SELECT industry FROM employers WHERE id = $1',
  [employerId]
);
const industry = employerResult.rows[0]?.industry || 'other';

// Send email with industry template
await emailService.sendTestInvitation(
  email, name, jobTitle, testLink,
  { ...testDetails, industry }
);
```

## Best Practices

### 1. Choose the Right Industry
- Select the industry that best matches your company
- Use "Other" if your industry isn't listed
- Consider your company culture and branding

### 2. Preview Before Saving
- Always preview templates before applying
- Check all email types to ensure consistency
- Verify colors match your brand

### 3. Test Emails
- Send test emails to yourself first
- Check rendering in different email clients
- Verify all links work correctly

### 4. Update Regularly
- Review templates periodically
- Update if you rebrand or change industries
- Keep content fresh and relevant

## Customization

### Custom Templates (Future Enhancement)

While the current version provides industry-specific templates, future versions will support:

- Custom color schemes
- Logo integration
- Custom header/footer content
- Personalized messaging
- Multi-language support

### Current Limitations

- Templates use predefined color schemes
- Content structure is fixed
- No custom HTML editing
- Single language (English) only

## Troubleshooting

### Templates Not Applying

1. **Check Industry Selection**
   - Verify industry is saved in Settings
   - Ensure you clicked "Save Template Selection"

2. **Clear Cache**
   - Restart the backend server
   - Clear browser cache

3. **Database Issues**
   - Run migration script if not done
   - Check employer table has industry column

### Email Not Sending

1. **SMTP Configuration**
   - Verify SMTP settings in .env
   - Test email configuration

2. **Industry Parameter**
   - Check routes pass industry parameter
   - Verify employer has industry set

3. **Template Service**
   - Check email-templates.js is loaded
   - Verify no syntax errors in templates

## Support

For issues or questions:

1. Check the troubleshooting section above
2. Review the API documentation
3. Check server logs for errors
4. Contact support with:
   - Industry selected
   - Email type affected
   - Error messages from logs

## Future Enhancements

Planned features for future releases:

- [ ] Custom color picker
- [ ] Logo upload and integration
- [ ] Custom email signatures
- [ ] A/B testing for templates
- [ ] Email analytics and open rates
- [ ] Multi-language support
- [ ] Template versioning
- [ ] Scheduled email campaigns
- [ ] Email preview in multiple clients
- [ ] Mobile-responsive testing

## Changelog

### Version 1.0.0 (Current)
- Initial release of industry-specific templates
- 8 industry options
- 5 email types supported
- Preview functionality
- Automatic template application

---

**Last Updated:** April 2026
**Version:** 1.0.0
**Maintained By:** HireFlow Development Team
