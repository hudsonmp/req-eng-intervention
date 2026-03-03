-- Fix user_id type to match ucsd_subjects.id (uuid instead of bigint)
ALTER TABLE consent_forms
  ALTER COLUMN user_id TYPE uuid USING user_id::text::uuid;

-- Recreate the index
DROP INDEX IF EXISTS idx_consent_forms_user_id;
CREATE INDEX idx_consent_forms_user_id ON consent_forms(user_id);
