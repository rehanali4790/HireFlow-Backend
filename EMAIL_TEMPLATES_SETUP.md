# Email Templates - Quick Setup Guide

## 🚀 Quick Start

Follow these steps to enable industry-specific email templates in HireFlow:

### Step 1: Run Database Migration

```bash
cd HireFlow-Backend
node run-email-template-migration.js
```

This adds the necessary database columns for email templates.

### Step 2: Restart Backend Server

```bash
# Stop the current server (Ctrl+C)
# Then restart
npm start
```

### Step 3: Configure in Settings

1. Open HireFlow web application
2. Go to **Settings** (click your profile icon)
3. Click on **Email Templates** tab
4. Select your industry from the options:
   - 💻 Technology
   - 🏥 Healthcare
   - 💼 Finance
   - 🎓 Education
   - 🛍️ Retail
   - 🏭 Manufacturing
   - 📊 Consulting
   - 🏢 Other

### Step 4: Preview Templates

1. Click **Show Preview** button
2. Select different email types to preview:
   - Application Confirmation
   - Test Invitation
   - AI Interview Invitation
   - Shortlist Notification
   - Rejection Email
3. Verify the colors and design match your preference

### Step 5: Save Selection

1. Click **Save Template Selection**
2. Wait for confirmation message
3. All future emails will use your selected template!

## ✅ Verification

To verify templates are working:

1. Create a test job posting
2. Submit a test application
3. Check the confirmation email
4. Verify it uses your selected industry colors

## 🎨 What's Included

### 8 Industry Templates

Each template includes:
- Custom color scheme
- Professional gradient headers
- Responsive design
- Consistent formatting
- Industry-appropriate tone

### 5 Email Types

All automated emails are styled:
- ✓ Application Confirmation
- 📝 Test Invitation
- 🎤 AI Interview Invitation
- 🎉 Shortlist Notification
- 📋 Rejection Email

## 📖 Features

- **Automatic Application**: Once selected, all emails use your template
- **Preview Before Saving**: See exactly how emails will look
- **No Code Required**: Simple UI-based configuration
- **Consistent Branding**: All emails match your industry style
- **Professional Design**: Modern, responsive email layouts

## 🔧 Technical Details

### Files Added/Modified

**Backend:**
- `services/email-templates.js` - Template definitions
- `services/email-service.js` - Updated to use templates
- `database/add-email-template-industry.sql` - Migration
- `routes/applications.js` - Industry parameter added
- `routes/tests.js` - Industry parameter added
- `routes/ai-interviews.js` - Industry parameter added

**Frontend:**
- `components/dashboard/EmailTemplatesTab.tsx` - Settings UI
- `views/SettingsPage.tsx` - Added email templates tab

### Database Changes

```sql
-- Added columns to email_templates table
ALTER TABLE email_templates ADD COLUMN industry text DEFAULT 'general';
ALTER TABLE email_templates ADD COLUMN is_default boolean DEFAULT false;
ALTER TABLE email_templates ADD COLUMN template_category text;
```

## 🎯 Industry Color Schemes

| Industry | Primary Color | Gradient |
|----------|--------------|----------|
| Technology | Indigo (#4F46E5) | Purple to Violet |
| Healthcare | Sky Blue (#0EA5E9) | Blue to Cyan |
| Finance | Navy (#1E40AF) | Dark to Light Blue |
| Education | Purple (#7C3AED) | Purple to Lavender |
| Retail | Red (#DC2626) | Red to Orange |
| Manufacturing | Slate (#475569) | Gray to Blue-Gray |
| Consulting | Teal (#0F766E) | Teal to Turquoise |
| Other | Indigo (#4F46E5) | Indigo to Light Indigo |

## 💡 Tips

1. **Choose Wisely**: Select the industry that best represents your company
2. **Preview All Types**: Check all 5 email types before saving
3. **Test First**: Send a test application to verify emails look correct
4. **Update Anytime**: You can change your industry selection at any time
5. **Consistent Branding**: Use the same industry across all communications

## 🐛 Troubleshooting

### Templates Not Showing
- Ensure migration ran successfully
- Check browser console for errors
- Verify backend server restarted

### Emails Not Styled
- Confirm industry is saved in Settings
- Check employer profile has industry field
- Verify email service is using templates

### Preview Not Working
- Clear browser cache
- Check React component loaded
- Verify API endpoints responding

## 📚 Documentation

For detailed documentation, see:
- `docs/EMAIL_TEMPLATES.md` - Complete guide
- `docs/API_DOCUMENTATION.md` - API reference

## 🆘 Support

If you encounter issues:

1. Check the troubleshooting section above
2. Review server logs for errors
3. Verify all files were created correctly
4. Ensure database migration completed

## 🎉 You're Done!

Your HireFlow installation now has professional, industry-specific email templates. All automated emails will be beautifully styled and consistent with your brand.

---

**Need Help?** Check the full documentation in `docs/EMAIL_TEMPLATES.md`
