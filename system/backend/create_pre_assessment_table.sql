-- Create pre_assessment_responses table to store all student responses

CREATE TABLE IF NOT EXISTS pre_assessment_responses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  study_id INTEGER NOT NULL,
  participant_id TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Question 1: System reflection
  system_reflection TEXT,

  -- Question 2: User types
  user_type_1 TEXT,
  user_type_2 TEXT,
  user_type_3 TEXT,
  user_types_feedback TEXT,

  -- Question 3: Actions for user type 1
  selected_actions JSONB,

  -- Question 4: Actions for stakeholder 2
  stakeholder2_actions TEXT,

  -- Question 5: Actions for stakeholder 3
  stakeholder3_actions TEXT,

  -- Question 6: Closed restaurant scenario MCQ
  closed_restaurant_answer TEXT,

  -- Question 7: Cancellation scenario MCQ
  cancellation_answer TEXT,

  -- Question 8: Important info MCQ
  important_info_answer TEXT,

  -- Question 9: Data collection by stakeholder
  data_collection JSONB,

  -- Question 10: Reflection on data types
  data_reflection TEXT,

  -- Question 11: Concurrent booking scenario
  concurrent_booking_answer TEXT,
  concurrent_booking_selected_data JSONB,

  -- Question 12: Table allocation scenario
  table_allocation_answer TEXT,
  table_allocation_selected_data JSONB,

  -- Question 13: Custom scenario
  custom_scenario TEXT,
  custom_scenario_response TEXT,

  -- Question 14: Combined iterations
  combined_iterations JSONB,

  -- Metadata
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on study_id and participant_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_pre_assessment_study_participant
ON pre_assessment_responses(study_id, participant_id);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_pre_assessment_responses_updated_at
BEFORE UPDATE ON pre_assessment_responses
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
