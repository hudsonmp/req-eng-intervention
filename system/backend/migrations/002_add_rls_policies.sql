-- Enable Row Level Security on consent_forms table
ALTER TABLE consent_forms ENABLE ROW LEVEL SECURITY;

-- Policy: Allow anyone to insert their own consent form
CREATE POLICY "Allow insert for authenticated users" ON consent_forms
  FOR INSERT
  TO authenticated, anon
  WITH CHECK (true);

-- Policy: Prevent users from reading consent forms (only backend with service role can read)
CREATE POLICY "Restrict read access" ON consent_forms
  FOR SELECT
  TO authenticated, anon
  USING (false);

-- Policy: Prevent updates to consent forms (immutable once submitted)
CREATE POLICY "Prevent updates" ON consent_forms
  FOR UPDATE
  TO authenticated, anon
  USING (false);

-- Policy: Prevent deletes
CREATE POLICY "Prevent deletes" ON consent_forms
  FOR DELETE
  TO authenticated, anon
  USING (false);

-- Add comment
COMMENT ON POLICY "Allow insert for authenticated users" ON consent_forms IS 'Allows participants to submit their consent forms';
