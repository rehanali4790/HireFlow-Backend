-- Add final_scoring table for storing final candidate scoring data
CREATE TABLE IF NOT EXISTS final_scoring (
  id SERIAL PRIMARY KEY,
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  parameters JSONB NOT NULL,
  final_score DECIMAL(5,2) NOT NULL,
  ai_decision TEXT,
  recommendation VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(application_id)
);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_final_scoring_application ON final_scoring(application_id);
CREATE INDEX IF NOT EXISTS idx_final_scoring_recommendation ON final_scoring(recommendation);

-- Add comment
COMMENT ON TABLE final_scoring IS 'Stores final scoring parameters and AI decisions for candidates';
