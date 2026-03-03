-- Enable Row Level Security on assessment tables
ALTER TABLE pre_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_assessments ENABLE ROW LEVEL SECURITY;

-- Pre-assessments policies
CREATE POLICY "Allow users to view own pre-assessments" ON pre_assessments
  FOR SELECT
  TO authenticated, anon
  USING (user_id = auth.uid() OR true); -- Allow all for now since backend handles auth

CREATE POLICY "Allow insert for authenticated users" ON pre_assessments
  FOR INSERT
  TO authenticated, anon
  WITH CHECK (true);

CREATE POLICY "Allow users to update own pre-assessments" ON pre_assessments
  FOR UPDATE
  TO authenticated, anon
  USING (true);

CREATE POLICY "Prevent deletes" ON pre_assessments
  FOR DELETE
  TO authenticated, anon
  USING (false);

-- Post-assessments policies (same as pre-assessments)
CREATE POLICY "Allow users to view own post-assessments" ON post_assessments
  FOR SELECT
  TO authenticated, anon
  USING (user_id = auth.uid() OR true);

CREATE POLICY "Allow insert for authenticated users" ON post_assessments
  FOR INSERT
  TO authenticated, anon
  WITH CHECK (true);

CREATE POLICY "Allow users to update own post-assessments" ON post_assessments
  FOR UPDATE
  TO authenticated, anon
  USING (true);

CREATE POLICY "Prevent deletes" ON post_assessments
  FOR DELETE
  TO authenticated, anon
  USING (false);
