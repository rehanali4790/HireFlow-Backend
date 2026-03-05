-- Seed default email templates
-- Run this after 001_initial_schema.sql

INSERT INTO email_templates (template_type, template_name, subject, html_body, is_default, is_active, variables)
VALUES 
-- 1. Application Received
('application_received', 'Default Application Received', 
 'Application Received - {{job_title}} at {{company_name}}',
 '<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5;">
<div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
<div style="background-color: #4F46E5; color: white; padding: 30px 20px; text-align: center;">
<h1 style="margin: 0; font-size: 24px;">Application Received!</h1>
</div>
<div style="padding: 30px 20px;">
<p style="font-size: 16px; color: #333;">Hi {{candidate_name}},</p>
<p style="font-size: 14px; color: #666; line-height: 1.6;">Thank you for applying for the <strong>{{job_title}}</strong> position at <strong>{{company_name}}</strong>.</p>
<p style="font-size: 14px; color: #666; line-height: 1.6;">We have received your application on {{application_date}} and our team will review it shortly. You will hear from us within 3-5 business days.</p>
<p style="font-size: 14px; color: #666; line-height: 1.6;">Best regards,<br>{{company_name}} Hiring Team</p>
</div>
<div style="background-color: #F3F4F6; padding: 20px; text-align: center; font-size: 12px; color: #666;">
<p>© 2024 {{company_name}}. All rights reserved.</p>
</div>
</div>
</body>
</html>', 
true, true, '["candidate_name", "job_title", "company_name", "application_date"]'::jsonb),

-- 2. Resume Parsed
('resume_parsed', 'Default Resume Parsed', 
 'Resume Successfully Processed - {{job_title}}',
 '<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5;">
<div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
<div style="background-color: #4F46E5; color: white; padding: 30px 20px; text-align: center;">
<h1 style="margin: 0; font-size: 24px;">Resume Processed</h1>
</div>
<div style="padding: 30px 20px;">
<p style="font-size: 16px; color: #333;">Hi {{candidate_name}},</p>
<p style="font-size: 14px; color: #666; line-height: 1.6;">Great news! We have successfully processed your resume for the <strong>{{job_title}}</strong> position.</p>
<p style="font-size: 14px; color: #666; line-height: 1.6;"><strong>What we found:</strong><br>
• Skills detected: {{skills_detected}}<br>
• Years of experience: {{experience_years}}</p>
<p style="font-size: 14px; color: #666; line-height: 1.6;">Our team will review your profile and get back to you soon.</p>
<p style="font-size: 14px; color: #666; line-height: 1.6;">Best regards,<br>{{company_name}} Hiring Team</p>
</div>
<div style="background-color: #F3F4F6; padding: 20px; text-align: center; font-size: 12px; color: #666;">
<p>© 2024 {{company_name}}. All rights reserved.</p>
</div>
</div>
</body>
</html>', 
true, true, '["candidate_name", "job_title", "skills_detected", "experience_years", "company_name"]'::jsonb),

-- 3. Test Invitation
('test_invitation', 'Default Test Invitation', 
 'Assessment Invitation - {{job_title}} at {{company_name}}',
 '<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5;">
<div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
<div style="background-color: #4F46E5; color: white; padding: 30px 20px; text-align: center;">
<h1 style="margin: 0; font-size: 24px;">Assessment Invitation</h1>
</div>
<div style="padding: 30px 20px;">
<p style="font-size: 16px; color: #333;">Hi {{candidate_name}},</p>
<p style="font-size: 14px; color: #666; line-height: 1.6;">Congratulations! You have been selected to take the assessment for the <strong>{{job_title}}</strong> position at <strong>{{company_name}}</strong>.</p>
<p style="font-size: 14px; color: #666; line-height: 1.6;"><strong>Test Details:</strong><br>
• Duration: {{test_duration}} minutes<br>
• Deadline: {{deadline}}</p>
<div style="text-align: center; margin: 30px 0;">
<a href="{{test_url}}" style="background-color: #4F46E5; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">Start Test</a>
</div>
<p style="font-size: 14px; color: #666; line-height: 1.6;">Good luck!<br>{{company_name}} Hiring Team</p>
</div>
<div style="background-color: #F3F4F6; padding: 20px; text-align: center; font-size: 12px; color: #666;">
<p>© 2024 {{company_name}}. All rights reserved.</p>
</div>
</div>
</body>
</html>', 
true, true, '["candidate_name", "job_title", "company_name", "test_url", "test_duration", "deadline"]'::jsonb),

-- 4. Shortlisted
('shortlisted', 'Default Shortlisted', 
 'Congratulations! You''ve Been Shortlisted - {{job_title}}',
 '<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5;">
<div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
<div style="background-color: #10B981; color: white; padding: 30px 20px; text-align: center;">
<h1 style="margin: 0; font-size: 24px;">🎉 You''ve Been Shortlisted!</h1>
</div>
<div style="padding: 30px 20px;">
<p style="font-size: 16px; color: #333;">Hi {{candidate_name}},</p>
<p style="font-size: 14px; color: #666; line-height: 1.6;">Excellent news! After reviewing your application, we are pleased to inform you that you have been shortlisted for the <strong>{{job_title}}</strong> position at <strong>{{company_name}}</strong>.</p>
<p style="font-size: 14px; color: #666; line-height: 1.6;"><strong>Next Steps:</strong><br>{{next_steps}}</p>
<p style="font-size: 14px; color: #666; line-height: 1.6;">We look forward to continuing the process with you!</p>
<p style="font-size: 14px; color: #666; line-height: 1.6;">Best regards,<br>{{company_name}} Hiring Team</p>
</div>
<div style="background-color: #F3F4F6; padding: 20px; text-align: center; font-size: 12px; color: #666;">
<p>© 2024 {{company_name}}. All rights reserved.</p>
</div>
</div>
</body>
</html>', 
true, true, '["candidate_name", "job_title", "company_name", "next_steps"]'::jsonb),

-- 5. AI Interview Invitation
('ai_interview_invitation', 'Default AI Interview Invitation', 
 'AI Interview Invitation - {{job_title}} at {{company_name}}',
 '<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5;">
<div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
<div style="background-color: #4F46E5; color: white; padding: 30px 20px; text-align: center;">
<h1 style="margin: 0; font-size: 24px;">AI Interview Invitation</h1>
</div>
<div style="padding: 30px 20px;">
<p style="font-size: 16px; color: #333;">Hi {{candidate_name}},</p>
<p style="font-size: 14px; color: #666; line-height: 1.6;">You''re invited to complete an AI-powered interview for the <strong>{{job_title}}</strong> position at <strong>{{company_name}}</strong>.</p>
<p style="font-size: 14px; color: #666; line-height: 1.6;"><strong>Interview Details:</strong><br>
• Duration: {{duration}} minutes<br>
• Deadline: {{deadline}}<br>
• Requirements: Webcam and microphone</p>
<div style="text-align: center; margin: 30px 0;">
<a href="{{interview_url}}" style="background-color: #4F46E5; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">Start Interview</a>
</div>
<p style="font-size: 14px; color: #666; line-height: 1.6;">Best of luck!<br>{{company_name}} Hiring Team</p>
</div>
<div style="background-color: #F3F4F6; padding: 20px; text-align: center; font-size: 12px; color: #666;">
<p>© 2024 {{company_name}}. All rights reserved.</p>
</div>
</div>
</body>
</html>', 
true, true, '["candidate_name", "job_title", "company_name", "interview_url", "duration", "deadline"]'::jsonb),

-- 6. Final Interview Scheduled
('final_interview_scheduled', 'Default Final Interview Scheduled', 
 'Final Interview Scheduled - {{job_title}}',
 '<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5;">
<div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
<div style="background-color: #4F46E5; color: white; padding: 30px 20px; text-align: center;">
<h1 style="margin: 0; font-size: 24px;">Final Interview Scheduled</h1>
</div>
<div style="padding: 30px 20px;">
<p style="font-size: 16px; color: #333;">Hi {{candidate_name}},</p>
<p style="font-size: 14px; color: #666; line-height: 1.6;">Your final interview for the <strong>{{job_title}}</strong> position has been scheduled!</p>
<p style="font-size: 14px; color: #666; line-height: 1.6;"><strong>Interview Details:</strong><br>
• Date: {{interview_date}}<br>
• Time: {{interview_time}}<br>
• Interviewer: {{interviewer_name}}</p>
<div style="text-align: center; margin: 30px 0;">
<a href="{{meeting_link}}" style="background-color: #4F46E5; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">Join Meeting</a>
</div>
<p style="font-size: 14px; color: #666; line-height: 1.6;">We look forward to speaking with you!<br>{{company_name}} Hiring Team</p>
</div>
<div style="background-color: #F3F4F6; padding: 20px; text-align: center; font-size: 12px; color: #666;">
<p>© 2024 {{company_name}}. All rights reserved.</p>
</div>
</div>
</body>
</html>', 
true, true, '["candidate_name", "job_title", "interview_date", "interview_time", "interviewer_name", "meeting_link", "company_name"]'::jsonb),

-- 7. Offer Extended
('offer_extended', 'Default Offer Extended', 
 'Job Offer - {{job_title}} at {{company_name}}',
 '<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5;">
<div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
<div style="background-color: #10B981; color: white; padding: 30px 20px; text-align: center;">
<h1 style="margin: 0; font-size: 24px;">🎊 Congratulations!</h1>
</div>
<div style="padding: 30px 20px;">
<p style="font-size: 16px; color: #333;">Hi {{candidate_name}},</p>
<p style="font-size: 14px; color: #666; line-height: 1.6;">We are thrilled to extend an offer for the <strong>{{job_title}}</strong> position at <strong>{{company_name}}</strong>!</p>
<p style="font-size: 14px; color: #666; line-height: 1.6;"><strong>Offer Details:</strong><br>
• Position: {{job_title}}<br>
• Salary: {{salary}}<br>
• Start Date: {{start_date}}<br>
• Response Deadline: {{offer_deadline}}</p>
<p style="font-size: 14px; color: #666; line-height: 1.6;">Please review the full offer details and let us know your decision by the deadline.</p>
<p style="font-size: 14px; color: #666; line-height: 1.6;">We''re excited about the possibility of you joining our team!<br>{{company_name}} Hiring Team</p>
</div>
<div style="background-color: #F3F4F6; padding: 20px; text-align: center; font-size: 12px; color: #666;">
<p>© 2024 {{company_name}}. All rights reserved.</p>
</div>
</div>
</body>
</html>', 
true, true, '["candidate_name", "job_title", "company_name", "salary", "start_date", "offer_deadline"]'::jsonb),

-- 8. Rejection
('rejection', 'Default Rejection', 
 'Application Update - {{job_title}} at {{company_name}}',
 '<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5;">
<div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
<div style="background-color: #6B7280; color: white; padding: 30px 20px; text-align: center;">
<h1 style="margin: 0; font-size: 24px;">Application Update</h1>
</div>
<div style="padding: 30px 20px;">
<p style="font-size: 16px; color: #333;">Hi {{candidate_name}},</p>
<p style="font-size: 14px; color: #666; line-height: 1.6;">Thank you for your interest in the <strong>{{job_title}}</strong> position at <strong>{{company_name}}</strong>.</p>
<p style="font-size: 14px; color: #666; line-height: 1.6;">After careful consideration, we have decided to move forward with other candidates whose qualifications more closely match our current needs.</p>
<p style="font-size: 14px; color: #666; line-height: 1.6;"><strong>Feedback:</strong><br>{{feedback}}</p>
<p style="font-size: 14px; color: #666; line-height: 1.6;">We appreciate the time you invested in the application process and encourage you to apply for future opportunities that match your skills and experience.</p>
<p style="font-size: 14px; color: #666; line-height: 1.6;">Best wishes in your job search,<br>{{company_name}} Hiring Team</p>
</div>
<div style="background-color: #F3F4F6; padding: 20px; text-align: center; font-size: 12px; color: #666;">
<p>© 2024 {{company_name}}. All rights reserved.</p>
</div>
</div>
</body>
</html>', 
true, true, '["candidate_name", "job_title", "company_name", "rejection_stage", "feedback"]'::jsonb)

ON CONFLICT DO NOTHING;

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Email templates seeded successfully!';
  RAISE NOTICE 'Total templates: 8';
END $$;
