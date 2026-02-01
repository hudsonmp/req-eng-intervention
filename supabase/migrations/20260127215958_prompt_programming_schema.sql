-- PromptLab Research Assistant Database Schema
-- All tables prefixed with PromptProgramming to avoid conflicts

-- Providers: Foundation model providers and their configurations
CREATE TABLE IF NOT EXISTS "PromptProgrammingProviders" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL UNIQUE,
    "provider_type" TEXT NOT NULL, -- 'openai', 'anthropic', 'google', 'meta', etc.
    "model_name" TEXT NOT NULL,
    "api_endpoint" TEXT,
    "default_hyperparameters" JSONB DEFAULT '{}',
    "capabilities" JSONB DEFAULT '{}',
    "active" BOOLEAN DEFAULT true,
    "created_at" TIMESTAMPTZ DEFAULT now(),
    "updated_at" TIMESTAMPTZ DEFAULT now()
);

-- Versions: Prompt versions with tree structure
CREATE TABLE IF NOT EXISTS "PromptProgrammingVersions" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "parent_id" UUID REFERENCES "PromptProgrammingVersions"("id") ON DELETE SET NULL,
    "version_number" TEXT NOT NULL, -- Semantic versioning or commit-style hash
    "prompt_content" TEXT NOT NULL,
    "metadata" JSONB DEFAULT '{}', -- Arbitrary metadata
    "behavioral_objectives" TEXT[], -- Array of stated objectives
    "tags" TEXT[], -- Searchable tags
    "created_at" TIMESTAMPTZ DEFAULT now(),
    "created_by" TEXT, -- Researcher identifier
    UNIQUE("version_number")
);

-- Create index for tree traversal
CREATE INDEX IF NOT EXISTS "idx_prompt_versions_parent" ON "PromptProgrammingVersions"("parent_id");
CREATE INDEX IF NOT EXISTS "idx_prompt_versions_created" ON "PromptProgrammingVersions"("created_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_prompt_versions_tags" ON "PromptProgrammingVersions" USING GIN("tags");

-- Components: Parsed structural components of prompts
CREATE TABLE IF NOT EXISTS "PromptProgrammingComponents" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "version_id" UUID NOT NULL REFERENCES "PromptProgrammingVersions"("id") ON DELETE CASCADE,
    "component_type" TEXT NOT NULL, -- 'instruction', 'example', 'constraint', 'output_format', 'context'
    "content" TEXT NOT NULL,
    "position" INTEGER NOT NULL, -- Order within the prompt
    "dependencies" UUID[], -- References to other component IDs this depends on
    "metadata" JSONB DEFAULT '{}',
    "created_at" TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_prompt_components_version" ON "PromptProgrammingComponents"("version_id");
CREATE INDEX IF NOT EXISTS "idx_prompt_components_type" ON "PromptProgrammingComponents"("component_type");

-- Rationale: Design decisions and change justifications
CREATE TABLE IF NOT EXISTS "PromptProgrammingRationale" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "version_id" UUID NOT NULL REFERENCES "PromptProgrammingVersions"("id") ON DELETE CASCADE,
    "change_description" TEXT NOT NULL,
    "intended_behavior_change" TEXT,
    "motivating_evidence" TEXT, -- Reference to runs or observations
    "alternatives_considered" TEXT[],
    "tradeoffs" TEXT,
    "created_at" TIMESTAMPTZ DEFAULT now(),
    "created_by" TEXT
);

CREATE INDEX IF NOT EXISTS "idx_prompt_rationale_version" ON "PromptProgrammingRationale"("version_id");

-- Runs: Execution logs for prompt testing
CREATE TABLE IF NOT EXISTS "PromptProgrammingRuns" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "version_id" UUID NOT NULL REFERENCES "PromptProgrammingVersions"("id") ON DELETE CASCADE,
    "provider_id" UUID NOT NULL REFERENCES "PromptProgrammingProviders"("id") ON DELETE CASCADE,
    "input_data" JSONB NOT NULL,
    "output_data" JSONB NOT NULL,
    "hyperparameters" JSONB DEFAULT '{}', -- temperature, max_tokens, etc.
    "latency_ms" INTEGER,
    "token_count" JSONB, -- {input: n, output: m, total: x}
    "cost_usd" NUMERIC(10, 6),
    "status" TEXT DEFAULT 'completed', -- 'completed', 'failed', 'timeout'
    "error_message" TEXT,
    "metadata" JSONB DEFAULT '{}',
    "created_at" TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_prompt_runs_version" ON "PromptProgrammingRuns"("version_id");
CREATE INDEX IF NOT EXISTS "idx_prompt_runs_provider" ON "PromptProgrammingRuns"("provider_id");
CREATE INDEX IF NOT EXISTS "idx_prompt_runs_created" ON "PromptProgrammingRuns"("created_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_prompt_runs_status" ON "PromptProgrammingRuns"("status");

-- Evaluations: Structured assessments of prompt behavior
CREATE TABLE IF NOT EXISTS "PromptProgrammingEvaluations" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "version_id" UUID NOT NULL REFERENCES "PromptProgrammingVersions"("id") ON DELETE CASCADE,
    "evaluation_type" TEXT NOT NULL, -- 'manual', 'automated', 'cross_provider'
    "criteria" JSONB NOT NULL, -- Structured evaluation criteria
    "results" JSONB NOT NULL, -- Evaluation results
    "run_ids" UUID[], -- Associated run IDs
    "summary" TEXT,
    "pass_fail" BOOLEAN,
    "created_at" TIMESTAMPTZ DEFAULT now(),
    "created_by" TEXT
);

CREATE INDEX IF NOT EXISTS "idx_prompt_evaluations_version" ON "PromptProgrammingEvaluations"("version_id");
CREATE INDEX IF NOT EXISTS "idx_prompt_evaluations_type" ON "PromptProgrammingEvaluations"("evaluation_type");

-- Sessions: Research sessions for tracking work context
CREATE TABLE IF NOT EXISTS "PromptProgrammingSessions" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "session_name" TEXT,
    "active_version_id" UUID REFERENCES "PromptProgrammingVersions"("id") ON DELETE SET NULL,
    "focus_area" TEXT,
    "notes" TEXT,
    "started_at" TIMESTAMPTZ DEFAULT now(),
    "ended_at" TIMESTAMPTZ,
    "metadata" JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS "idx_prompt_sessions_started" ON "PromptProgrammingSessions"("started_at" DESC);

-- Enable Row Level Security (RLS) on all tables
ALTER TABLE "PromptProgrammingProviders" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PromptProgrammingVersions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PromptProgrammingComponents" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PromptProgrammingRationale" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PromptProgrammingRuns" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PromptProgrammingEvaluations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PromptProgrammingSessions" ENABLE ROW LEVEL SECURITY;

-- Create policies (adjust based on your authentication setup)
-- For now, allowing all authenticated users full access
-- You should customize these policies based on your security requirements

CREATE POLICY "Allow all for authenticated users" ON "PromptProgrammingProviders"
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow all for authenticated users" ON "PromptProgrammingVersions"
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow all for authenticated users" ON "PromptProgrammingComponents"
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow all for authenticated users" ON "PromptProgrammingRationale"
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow all for authenticated users" ON "PromptProgrammingRuns"
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow all for authenticated users" ON "PromptProgrammingEvaluations"
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow all for authenticated users" ON "PromptProgrammingSessions"
    FOR ALL USING (auth.role() = 'authenticated');

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add updated_at trigger to Providers table
CREATE TRIGGER update_prompt_programming_providers_updated_at
    BEFORE UPDATE ON "PromptProgrammingProviders"
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
