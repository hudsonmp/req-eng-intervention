-- Create pre_assessments table
CREATE TABLE IF NOT EXISTS pre_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES ucsd_subjects(id) ON DELETE CASCADE,
  subject_number INTEGER NOT NULL,
  status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'submitted')),
  responses JSONB DEFAULT '{}',
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  submitted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create post_assessments table
CREATE TABLE IF NOT EXISTS post_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES ucsd_subjects(id) ON DELETE CASCADE,
  subject_number INTEGER NOT NULL,
  status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'submitted')),
  responses JSONB DEFAULT '{}',
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  submitted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for faster lookups
CREATE INDEX idx_pre_assessments_user_id ON pre_assessments(user_id);
CREATE INDEX idx_pre_assessments_subject_number ON pre_assessments(subject_number);
CREATE INDEX idx_post_assessments_user_id ON post_assessments(user_id);
CREATE INDEX idx_post_assessments_subject_number ON post_assessments(subject_number);

-- Add updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers to auto-update updated_at
CREATE TRIGGER update_pre_assessments_updated_at
    BEFORE UPDATE ON pre_assessments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_post_assessments_updated_at
    BEFORE UPDATE ON post_assessments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add comments
COMMENT ON TABLE pre_assessments IS 'Stores pre-assessment responses for study participants';
COMMENT ON TABLE post_assessments IS 'Stores post-assessment responses for study participants';
COMMENT ON COLUMN pre_assessments.responses IS 'JSONB field storing all question responses and table data';
COMMENT ON COLUMN post_assessments.responses IS 'JSONB field storing all question responses and table data';
