// Core type definitions for PromptLab

export interface Provider {
  id: string;
  name: string;
  provider_type: string;
  model_name: string;
  api_endpoint?: string;
  default_hyperparameters: Record<string, any>;
  capabilities: Record<string, any>;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PromptVersion {
  id: string;
  parent_id?: string;
  version_number: string;
  prompt_content: string;
  metadata: Record<string, any>;
  behavioral_objectives: string[];
  tags: string[];
  created_at: string;
  created_by?: string;
}

export interface Component {
  id: string;
  version_id: string;
  component_type: 'instruction' | 'example' | 'constraint' | 'output_format' | 'context';
  content: string;
  position: number;
  dependencies: string[];
  metadata: Record<string, any>;
  created_at: string;
}

export interface Rationale {
  id: string;
  version_id: string;
  change_description: string;
  intended_behavior_change?: string;
  motivating_evidence?: string;
  alternatives_considered: string[];
  tradeoffs?: string;
  created_at: string;
  created_by?: string;
}

export interface Run {
  id: string;
  version_id: string;
  provider_id: string;
  input_data: Record<string, any>;
  output_data: Record<string, any>;
  hyperparameters: Record<string, any>;
  latency_ms?: number;
  token_count?: {
    input: number;
    output: number;
    total: number;
  };
  cost_usd?: number;
  status: 'completed' | 'failed' | 'timeout';
  error_message?: string;
  metadata: Record<string, any>;
  created_at: string;
}

export interface Evaluation {
  id: string;
  version_id: string;
  evaluation_type: 'manual' | 'automated' | 'cross_provider';
  criteria: Record<string, any>;
  results: Record<string, any>;
  run_ids: string[];
  summary?: string;
  pass_fail?: boolean;
  created_at: string;
  created_by?: string;
}

export interface Session {
  id: string;
  session_name?: string;
  active_version_id?: string;
  focus_area?: string;
  notes?: string;
  started_at: string;
  ended_at?: string;
  metadata: Record<string, any>;
}

export interface ComponentDiff {
  type: 'added' | 'removed' | 'modified' | 'unchanged';
  component_type: string;
  old_content?: string;
  new_content?: string;
  position_change?: { from: number; to: number };
  behavioral_hypothesis?: string;
}

export interface VersionDiff {
  version_a: string;
  version_b: string;
  textual_diff: string;
  component_diffs: ComponentDiff[];
  behavioral_hypotheses: string[];
  structural_changes: string[];
}

export interface AnalysisResult {
  version_id: string;
  components: Component[];
  structural_issues: string[];
  ambiguities: string[];
  implicit_assumptions: string[];
  provider_sensitivities: string[];
  improvement_suggestions: string[];
}

export interface CoverageAnalysis {
  version_id: string;
  test_inputs: any[];
  intended_distribution: string;
  coverage_gaps: string[];
  edge_cases: string[];
  recommendations: string[];
}
