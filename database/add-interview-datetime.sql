-- Persist interview schedule for pipeline filters (Today / Upcoming / Not Attended)
ALTER TABLE applications
ADD COLUMN IF NOT EXISTS interview_date DATE,
ADD COLUMN IF NOT EXISTS interview_time TIME;

CREATE INDEX IF NOT EXISTS idx_applications_interview_date ON applications(interview_date);
CREATE INDEX IF NOT EXISTS idx_applications_status ON applications(status);
