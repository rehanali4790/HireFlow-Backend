-- Pipeline event history for funnel analytics + skip/move tracking
CREATE TABLE IF NOT EXISTS application_pipeline_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  stage VARCHAR(50) NOT NULL,
  action VARCHAR(50) NOT NULL,
  from_status VARCHAR(50),
  to_status VARCHAR(50),
  outcome VARCHAR(50),
  notes TEXT,
  actor_name TEXT,
  actor_email TEXT,
  actor_role TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pipeline_events_application ON application_pipeline_events(application_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_events_stage ON application_pipeline_events(stage);
CREATE INDEX IF NOT EXISTS idx_pipeline_events_created ON application_pipeline_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pipeline_events_action ON application_pipeline_events(action);
