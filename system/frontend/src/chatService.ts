// API service for /intervention - calls real backend

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8000';

// Get study type by ID
export async function getStudyType(studyId: number): Promise<{ type: string }> {
  const res = await fetch(`${API_BASE}/study/${studyId}/type`);
  if (!res.ok) {
    throw new Error('Study not found');
  }
  return res.json();
}

// Types
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
  io_pairs?: any;
  simulation_result?: any;
  bug_description?: string;
}

export interface ScaffoldedValueOption {
  stakeholder: string;
  attribute: string;
  options: string[];
}

export interface HypothesisResult {
  bug_exposed: boolean;
  hint: string;
  feedback: string;
}

// Chat
export async function sendMessage(
  message: string,
  studyId: number,
  participantId: string,
  turnNumber: number
): Promise<{ response: string; turn_number: number }> {
  // Skip API call if in test mode
  if (participantId === 'test') {
    return { response: 'Test mode: No response from backend', turn_number: turnNumber + 1 };
  }

  const res = await fetch(`${API_BASE}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, study_id: studyId, participant_id: participantId, turn_number: turnNumber })
  });
  return res.json();
}

// Log attribute add/delete
export async function logAttribute(
  studyId: number,
  participantId: string,
  stakeholder: string,
  attribute: string,
  action: 'add' | 'delete',
  turn: number
): Promise<void> {
  // Skip API call if in test mode
  if (participantId === 'test') {
    return;
  }

  await fetch(`${API_BASE}/intervention/log-attribute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ study_id: studyId, participant_id: participantId, stakeholder, attribute, action, turn })
  });
}

// Begin helping student
export async function beginHelpingStudent(
  studyId: number,
  participantId: string,
  turnNumber: number,
  stakeholderAttributes: StakeholderAttribute[]
): Promise<InterventionResponse> {
  // Skip API call if in test mode
  if (participantId === 'test') {
    return { success: true, message: 'Test mode: No backend response' };
  }

  const res = await fetch(`${API_BASE}/intervention/begin-helping`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      study_id: studyId,
      participant_id: participantId,
      turn_number: turnNumber,
      stakeholder_attributes: stakeholderAttributes
    })
  });
  return res.json();
}

// Submit cost function
export async function submitCostFunction(
  studyId: number,
  participantId: string,
  turnNumber: number,
  optimizationTarget: string
): Promise<void> {
  // Skip API call if in test mode
  if (participantId === 'test') {
    return;
  }

  await fetch(`${API_BASE}/intervention/submit-cost-function`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      study_id: studyId,
      participant_id: participantId,
      turn_number: turnNumber,
      optimization_target: optimizationTarget,
      weights: {}
    })
  });
}

// Test student code
export async function testStudentCode(
  studyId: number,
  participantId: string,
  turnNumber: number,
  testCases: StakeholderAttribute[]
): Promise<InterventionResponse> {
  // Skip API call if in test mode
  if (participantId === 'test') {
    return { success: true, message: 'Test mode: No backend response' };
  }

  const res = await fetch(`${API_BASE}/intervention/test-student-code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      study_id: studyId,
      participant_id: participantId,
      turn_number: turnNumber,
      test_cases: testCases
    })
  });
  return res.json();
}

// Log exploratory actions
export async function logExploratory(
  studyId: number,
  participantId: string,
  runNumber: number,
  action: string,
  data: { stakeholder?: string; attribute?: string; value?: string }
): Promise<void> {
  // Skip API call if in test mode
  if (participantId === 'test') {
    return;
  }

  await fetch(`${API_BASE}/intervention/log-exploratory`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      study_id: studyId,
      participant_id: participantId,
      run_number: runNumber,
      action,
      ...data
    })
  });
}

// Generate scaffolded values
export async function generateScaffoldedValues(
  studyId: number,
  participantId: string,
  turnNumber: number,
  runNumber: number
): Promise<{ scaffolded_values: { value_options: ScaffoldedValueOption[] } }> {
  // Skip API call if in test mode
  if (participantId === 'test') {
    return { scaffolded_values: { value_options: [] } };
  }

  const res = await fetch(`${API_BASE}/intervention/generate-scaffolded-values`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      study_id: studyId,
      participant_id: participantId,
      turn_number: turnNumber,
      run_number: runNumber
    })
  });
  return res.json();
}

// Get bug queue
export async function getBugQueue(
  studyId: number,
  participantId: string
): Promise<{ run_number: number; bug_id: string; phase: string }> {
  // Skip API call if in test mode
  if (participantId === 'test') {
    return { run_number: 1, bug_id: 'test_bug', phase: 'test' };
  }

  const res = await fetch(`${API_BASE}/intervention/bug-queue/${studyId}/${participantId}`);
  return res.json();
}

// Complete run
export async function completeRun(
  studyId: number,
  participantId: string,
  runNumber: number,
  bugFound: boolean
): Promise<{ next_run: number; message: string }> {
  // Skip API call if in test mode
  if (participantId === 'test') {
    return { next_run: runNumber + 1, message: 'Test mode: Run completed' };
  }

  const res = await fetch(`${API_BASE}/intervention/complete-run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      study_id: studyId,
      participant_id: participantId,
      run_number: runNumber,
      bug_found: bugFound
    })
  });
  return res.json();
}

// Switch mode
export async function switchMode(
  studyId: number,
  participantId: string,
  runNumber: number,
  newMode: 'helping' | 'exploratory'
): Promise<void> {
  // Skip API call if in test mode
  if (participantId === 'test') {
    return;
  }

  await fetch(`${API_BASE}/intervention/switch-mode?study_id=${studyId}&participant_id=${participantId}&run_number=${runNumber}&new_mode=${newMode}`, {
    method: 'POST'
  });
}

// Submit hypothesis
export async function submitHypothesis(
  studyId: number,
  participantId: string,
  runNumber: number,
  turnNumber: number,
  testCases: { stakeholder: string; attribute: string; value: string }[],
  justification: string,
  expectedBehavior: string
): Promise<HypothesisResult> {
  // Skip API call if in test mode
  if (participantId === 'test') {
    return { bug_exposed: false, hint: 'Test mode', feedback: 'Test mode: No backend response' };
  }

  const res = await fetch(`${API_BASE}/intervention/submit-hypothesis`, {
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
    })
  });
  return res.json();
}
