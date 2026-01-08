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
