-- Create consent_forms table to store signed informed consent forms
CREATE TABLE IF NOT EXISTS consent_forms (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL,
  subject_number INTEGER NOT NULL,
  participant_signature TEXT NOT NULL,
  participant_date TEXT NOT NULL,
  printed_name TEXT NOT NULL,
  researcher_signature TEXT,
  submitted_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on user_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_consent_forms_user_id ON consent_forms(user_id);

-- Create index on subject_number for faster lookups
CREATE INDEX IF NOT EXISTS idx_consent_forms_subject_number ON consent_forms(subject_number);

-- Add comment to table
COMMENT ON TABLE consent_forms IS 'Stores signed informed consent forms from study participants';
