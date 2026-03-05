-- Create sample data for testing the application

-- Insert a sample employer
INSERT INTO employers (
  id,
  company_name,
  company_description,
  contact_email,
  industry,
  company_size,
  website
) VALUES (
  '11111111-1111-1111-1111-111111111111',
  'TechCorp Solutions',
  'Leading technology company specializing in AI and cloud solutions',
  'hr@techcorp.com',
  'Technology',
  '100-500',
  'https://techcorp.example.com'
) ON CONFLICT (id) DO NOTHING;

-- Insert sample jobs
INSERT INTO jobs (
  id,
  employer_id,
  title,
  description,
  requirements,
  responsibilities,
  skills_required,
  location,
  work_type,
  remote_policy,
  salary_min,
  salary_max,
  salary_currency,
  experience_level,
  status,
  positions_available
) VALUES 
(
  '22222222-2222-2222-2222-222222222222',
  '11111111-1111-1111-1111-111111111111',
  'Senior Full Stack Developer',
  'We are looking for an experienced Full Stack Developer to join our growing team.',
  'Bachelor''s degree in Computer Science or related field. 5+ years of experience in web development.',
  'Design and develop scalable web applications. Collaborate with cross-functional teams. Mentor junior developers.',
  ARRAY['JavaScript', 'React', 'Node.js', 'PostgreSQL', 'TypeScript', 'AWS'],
  'San Francisco, CA',
  'full-time',
  'hybrid',
  120000,
  180000,
  'USD',
  'senior',
  'active',
  2
),
(
  '33333333-3333-3333-3333-333333333333',
  '11111111-1111-1111-1111-111111111111',
  'Frontend Developer',
  'Join our team to build amazing user interfaces and experiences.',
  'Bachelor''s degree or equivalent experience. 3+ years of frontend development.',
  'Build responsive web applications. Work with designers to implement UI/UX. Optimize application performance.',
  ARRAY['React', 'JavaScript', 'CSS', 'HTML', 'TypeScript', 'Tailwind CSS'],
  'Remote',
  'full-time',
  'remote',
  90000,
  130000,
  'USD',
  'mid',
  'active',
  3
),
(
  '44444444-4444-4444-4444-444444444444',
  '11111111-1111-1111-1111-111111111111',
  'DevOps Engineer',
  'Help us build and maintain our cloud infrastructure.',
  '4+ years of DevOps experience. Strong knowledge of AWS and containerization.',
  'Manage CI/CD pipelines. Monitor system performance. Implement security best practices.',
  ARRAY['AWS', 'Docker', 'Kubernetes', 'Terraform', 'Jenkins', 'Linux'],
  'New York, NY',
  'full-time',
  'hybrid',
  110000,
  160000,
  'USD',
  'senior',
  'active',
  1
)
ON CONFLICT (id) DO NOTHING;

-- Insert a sample test for one of the jobs
INSERT INTO tests (
  id,
  job_id,
  employer_id,
  title,
  description,
  test_type,
  duration_minutes,
  passing_score,
  questions,
  is_active,
  ai_evaluation_enabled
) VALUES (
  '55555555-5555-5555-5555-555555555555',
  '22222222-2222-2222-2222-222222222222',
  '11111111-1111-1111-1111-111111111111',
  'Full Stack Developer Technical Assessment',
  'This test evaluates your knowledge of full stack development concepts.',
  'mixed',
  60,
  70,
  '[
    {
      "id": 1,
      "type": "mcq",
      "question": "What is the purpose of React hooks?",
      "options": ["State management", "Styling", "Routing", "Testing"],
      "correct_answer": 0
    },
    {
      "id": 2,
      "type": "coding",
      "question": "Write a function to reverse a string in JavaScript",
      "expected_output": "Function should reverse input string"
    }
  ]'::jsonb,
  true,
  true
) ON CONFLICT (id) DO NOTHING;

-- Add comments
COMMENT ON TABLE employers IS 'Sample employer data for testing';
COMMENT ON TABLE jobs IS 'Sample job postings for testing';
COMMENT ON TABLE tests IS 'Sample tests for job positions';
