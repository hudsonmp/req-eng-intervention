-- Intervention System Schema
-- Purpose: Track intervention sessions, messages, state, tests, requirements, and transitions

-- Core session tracking
CREATE TABLE intervention_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT,
    started_at TIMESTAMPTZ DEFAULT now(),
    ended_at TIMESTAMPTZ,
    current_phase TEXT DEFAULT 'charter_construction',
    confusion_level INTEGER DEFAULT 0,
    dimensions_identified INTEGER DEFAULT 0,
    requirements_surfaced INTEGER DEFAULT 0,
    tests_executed INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}'
);

-- Conversation messages
CREATE TABLE intervention_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES intervention_sessions(id) ON DELETE CASCADE,
    role TEXT NOT NULL,  -- 'user' | 'alex' | 'system'
    content TEXT NOT NULL,
    sequence_number INTEGER NOT NULL,
    confusion_level INTEGER,
    transition_rule_fired TEXT,
    timestamp TIMESTAMPTZ DEFAULT now(),
    metadata JSONB DEFAULT '{}'
);

-- State snapshots (for debugging/analysis)
CREATE TABLE intervention_state (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES intervention_sessions(id) ON DELETE CASCADE,
    phase TEXT NOT NULL,
    dimensions_identified TEXT[],
    dimensions_pending TEXT[],
    requirements JSONB DEFAULT '[]',
    confusion_level INTEGER DEFAULT 0,
    premature_test_attempts INTEGER DEFAULT 0,
    predictions_skipped INTEGER DEFAULT 0,
    last_transition TEXT,
    snapshot_at TIMESTAMPTZ DEFAULT now()
);

-- Test executions
CREATE TABLE intervention_tests_executed (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES intervention_sessions(id) ON DELETE CASCADE,
    test_case JSONB NOT NULL,
    user_prediction TEXT,
    actual_outcome TEXT,
    passed BOOLEAN,
    bugs_triggered TEXT[],
    simulation_results JSONB,
    executed_at TIMESTAMPTZ DEFAULT now()
);

-- Requirements discovered
CREATE TABLE intervention_requirements_surfaced (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES intervention_sessions(id) ON DELETE CASCADE,
    requirement_text TEXT NOT NULL,
    generalization TEXT,
    confidence DECIMAL(3,2) DEFAULT 0.5,
    surfaced_at TIMESTAMPTZ DEFAULT now()
);

-- Analytics - track phase transitions
CREATE TABLE intervention_transitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES intervention_sessions(id) ON DELETE CASCADE,
    rule_name TEXT NOT NULL,
    from_phase TEXT,
    to_phase TEXT,
    occurred_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX idx_messages_session ON intervention_messages(session_id, sequence_number);
CREATE INDEX idx_state_session ON intervention_state(session_id, snapshot_at DESC);
CREATE INDEX idx_tests_session ON intervention_tests_executed(session_id, executed_at DESC);
CREATE INDEX idx_requirements_session ON intervention_requirements_surfaced(session_id, surfaced_at DESC);
CREATE INDEX idx_transitions_session ON intervention_transitions(session_id, occurred_at DESC);

-- Add comments for documentation
COMMENT ON TABLE intervention_sessions IS 'Core session tracking for pedagogical intervention system';
COMMENT ON TABLE intervention_messages IS 'All conversation messages between user and Alex';
COMMENT ON TABLE intervention_state IS 'State snapshots for debugging and analysis';
COMMENT ON TABLE intervention_tests_executed IS 'Log of all test executions with predictions and outcomes';
COMMENT ON TABLE intervention_requirements_surfaced IS 'Requirements discovered through dialogue';
COMMENT ON TABLE intervention_transitions IS 'Phase transition events for analytics';
