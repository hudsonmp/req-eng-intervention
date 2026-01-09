const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

interface ChatRequest {
  message: string;
  study_id: number;
  participant_id: string;
  turn_number: number;
}

interface ChatResponse {
  response: string;
  turn_number: number;
}

export async function sendMessage(
  message: string,
  studyId: number,
  participantId: string,
  turnNumber: number
): Promise<ChatResponse> {
  const response = await fetch(`${API_URL}/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message,
      study_id: studyId,
      participant_id: participantId,
      turn_number: turnNumber,
    } as ChatRequest),
  });

  if (!response.ok) {
    throw new Error('Failed to send message');
  }

  return response.json();
}

export async function resetData(): Promise<void> {
  const response = await fetch(`${API_URL}/reset`, {
    method: 'POST',
  });

  if (!response.ok) {
    throw new Error('Failed to reset data');
  }
}

// ============ INTERVENTION API FUNCTIONS ============

export interface StakeholderAttribute {
  stakeholder: string;
  attribute: string;
  value?: string;
  value2?: string;
}

export interface InterventionResponse {
  success: boolean;
  message: string;
  student_message?: string;
  io_pairs?: {
    io_pairs?: Array<{ stakeholder: string; attribute: string; value: string }>;
    test_result?: string;
    test_scenarios?: Array<{ inputs: Record<string, any>; expected_output: string; reveals_bug: boolean }>;
  };
  simulation_result?: {
    test_passed: boolean;
    metrics: Record<string, any>;
    assignments: Array<Record<string, any>>;
    bug_triggered: boolean;
  };
}

export async function logAttribute(
  studyId: number,
  participantId: string,
  stakeholder: string,
  attribute: string,
  action: 'add' | 'delete',
  turn: number
): Promise<{ status: string; action: string }> {
  const response = await fetch(`${API_URL}/intervention/log-attribute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      study_id: studyId,
      participant_id: participantId,
      stakeholder,
      attribute,
      action,
      turn
    }),
  });

  if (!response.ok) throw new Error('Failed to log attribute');
  return response.json();
}

export async function beginHelpingStudent(
  studyId: number,
  participantId: string,
  turnNumber: number,
  stakeholderAttributes: StakeholderAttribute[]
): Promise<InterventionResponse> {
  const response = await fetch(`${API_URL}/intervention/begin-helping`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      study_id: studyId,
      participant_id: participantId,
      turn_number: turnNumber,
      stakeholder_attributes: stakeholderAttributes
    }),
  });

  if (!response.ok) throw new Error('Failed to begin helping student');
  return response.json();
}

export async function submitCostFunction(
  studyId: number,
  participantId: string,
  turnNumber: number,
  optimizationTarget: string
): Promise<{ status: string; optimization_target: string }> {
  const response = await fetch(`${API_URL}/intervention/submit-cost-function`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      study_id: studyId,
      participant_id: participantId,
      turn_number: turnNumber,
      optimization_target: optimizationTarget,
      weights: {}  // Empty, kept for API compatibility
    }),
  });

  if (!response.ok) throw new Error('Failed to submit cost function');
  return response.json();
}

export async function generateScaffoldedTests(
  studyId: number,
  participantId: string,
  turnNumber: number,
  stakeholderAttributes: StakeholderAttribute[]
): Promise<InterventionResponse> {
  const response = await fetch(`${API_URL}/intervention/generate-scaffolded-tests`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      study_id: studyId,
      participant_id: participantId,
      turn_number: turnNumber,
      stakeholder_attributes: stakeholderAttributes
    }),
  });

  if (!response.ok) throw new Error('Failed to generate scaffolded tests');
  return response.json();
}

export async function testStudentCode(
  studyId: number,
  participantId: string,
  turnNumber: number,
  testCases: StakeholderAttribute[]
): Promise<InterventionResponse> {
  const response = await fetch(`${API_URL}/intervention/test-student-code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      study_id: studyId,
      participant_id: participantId,
      turn_number: turnNumber,
      test_cases: testCases
    }),
  });

  if (!response.ok) throw new Error('Failed to test student code');
  return response.json();
}

export async function getStakeholderAttributes(
  studyId: number,
  participantId: string,
  turn: number
): Promise<{ status: string; attributes: Array<Record<string, any>> }> {
  const response = await fetch(
    `${API_URL}/intervention/stakeholder-attributes/${studyId}/${participantId}/${turn}`,
    { method: 'GET' }
  );

  if (!response.ok) throw new Error('Failed to get stakeholder attributes');
  return response.json();
}

// ============ EXPLORATORY MODE & BUG QUEUE API ============

export interface ScaffoldedValueOption {
  stakeholder: string;
  attribute: string;
  options: string[];  // 3 options: safe, edge_case, bug_trigger
}

export async function logExploratory(
  studyId: number,
  participantId: string,
  runNumber: number,
  action: 'add' | 'delete' | 'test_run',
  data: {
    stakeholder?: string;
    attribute?: string;
    value?: string;
  }
): Promise<{ status: string; action: string; run_number: number }> {
  const response = await fetch(`${API_URL}/intervention/log-exploratory`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      study_id: studyId,
      participant_id: participantId,
      run_number: runNumber,
      action,
      ...data
    }),
  });

  if (!response.ok) throw new Error('Failed to log exploratory action');
  return response.json();
}

export interface HypothesisResult {
  status: string;
  bug_exposed: boolean;
  hint: string;
  feedback: string;
}

export async function submitHypothesis(
  studyId: number,
  participantId: string,
  runNumber: number,
  turnNumber: number,
  testCases: Array<{ stakeholder: string; attribute: string; value: string }>,
  justification: string,
  expectedBehavior: string
): Promise<HypothesisResult> {
  const response = await fetch(`${API_URL}/intervention/submit-hypothesis`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      study_id: studyId,
      participant_id: participantId,
      run_number: runNumber,
      turn_number: turnNumber,
      test_cases: testCases,
      justification,
      expected_behavior: expectedBehavior
    }),
  });

  if (!response.ok) throw new Error('Failed to submit hypothesis');
  return response.json();
}

export async function generateScaffoldedValues(
  studyId: number,
  participantId: string,
  turnNumber: number,
  runNumber: number
): Promise<{ status: string; scaffolded_values: { value_options: ScaffoldedValueOption[] } }> {
  const response = await fetch(`${API_URL}/intervention/generate-scaffolded-values`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      study_id: studyId,
      participant_id: participantId,
      turn_number: turnNumber,
      run_number: runNumber
    }),
  });

  if (!response.ok) throw new Error('Failed to generate scaffolded values');
  return response.json();
}

export async function getBugQueue(
  studyId: number,
  participantId: string
): Promise<{ run_number: number; bug_id: string; phase: string; scaffolded_values: any }> {
  const response = await fetch(
    `${API_URL}/intervention/bug-queue/${studyId}/${participantId}`,
    { method: 'GET' }
  );

  if (!response.ok) throw new Error('Failed to get bug queue');
  return response.json();
}

export async function completeRun(
  studyId: number,
  participantId: string,
  runNumber: number,
  bugFound: boolean,
  explanation?: string
): Promise<{ status: string; run_completed: number; next_run: number; message: string }> {
  const response = await fetch(`${API_URL}/intervention/complete-run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      study_id: studyId,
      participant_id: participantId,
      run_number: runNumber,
      bug_found: bugFound,
      participant_explanation: explanation
    }),
  });

  if (!response.ok) throw new Error('Failed to complete run');
  return response.json();
}

export async function switchMode(
  studyId: number,
  participantId: string,
  runNumber: number,
  newMode: 'exploratory' | 'helping'
): Promise<{ status: string; mode: string }> {
  const response = await fetch(
    `${API_URL}/intervention/switch-mode?study_id=${studyId}&participant_id=${participantId}&run_number=${runNumber}&new_mode=${newMode}`,
    { method: 'POST' }
  );

  if (!response.ok) throw new Error('Failed to switch mode');
  return response.json();
}
