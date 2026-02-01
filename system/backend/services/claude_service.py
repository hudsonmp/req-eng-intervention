"""
Claude Service - Manages Claude API integration for Alex persona.
Builds state-aware system prompts and generates Alex's responses.
"""

from typing import List
import anthropic
import json

from ..models import InterventionState, Action, AlexResponse, Message, Requirement


class ClaudeService:
    """Manages Claude API integration with state-aware prompts."""

    def __init__(self, anthropic_api_key: str):
        self.client = anthropic.Anthropic(api_key=anthropic_api_key)

    def generate_response(
        self,
        user_message: str,
        state: InterventionState,
        action: Action,
        conversation_history: List[Message]
    ) -> AlexResponse:
        """
        Generate Alex's response given the current state and action directive.
        """
        system_prompt = self._build_system_prompt(state, action)
        messages = self._build_conversation_messages(conversation_history, user_message)

        response = self.client.messages.create(
            model="claude-sonnet-4-5-20250929",
            max_tokens=2048,
            system=system_prompt,
            messages=messages
        )

        alex_message = response.content[0].text

        # Extract metadata from response if needed
        alex_response = AlexResponse(
            message=alex_message,
            confusion_delta=action.confusion_delta,
            metadata={
                "rule_fired": action.rule_name,
                "phase": state.phase
            }
        )

        # Check if we should save a requirement (based on action)
        if action.should_save_requirement:
            # Extract requirement from user's explanation
            requirement = self._extract_requirement(user_message)
            if requirement:
                alex_response.requirement_crystallized = requirement

        return alex_response

    def _build_system_prompt(self, state: InterventionState, action: Action) -> str:
        """
        Build a state-aware system prompt that gives Alex context and directive.
        """
        return f"""You are Alex, a CS1 student who wrote a vehicle assignment system for a ride-sharing app.
You genuinely believe your code works but want help testing it thoroughly.

YOUR CODE'S BUGS (YOU DON'T KNOW THESE - They'll be discovered through testing):
1. Primary: When assigning a vehicle, you don't set is_available = False
   → This means the same vehicle can be assigned to multiple riders
2. Secondary: When reassigning a vehicle, you don't clean up the previous assignment
   → This leaves stale references
3. Tertiary: You check availability at selection time, not at assignment time
   → This creates a race condition where two requests can select the same vehicle

CURRENT STATE:
- Phase: {state.phase}
- Confusion Level: {state.confusion_level}/10
- Dimensions Identified: {', '.join(state.dimensions_identified) if state.dimensions_identified else 'none yet'}
- Requirements Surfaced: {len(state.requirements_surfaced)}
- Tests Run: {len(state.tests_executed)}

PERSONA RULES:
- You're eager but uncertain about testing - you need guidance
- You get genuinely confused when tests fail unexpectedly
- You need the human to explain WHY failures happen - don't figure it out yourself
- You gradually discover requirements through dialogue, not by reading code
- You're humble and appreciate the help
- Use natural student language - "Wait, that's weird...", "Hmm, why did that happen?"
- Don't be overly formal or robotic

CURRENT CONFUSION LEVEL INTERPRETATION:
- 0-2: Confident, things are working as expected
- 3-5: Starting to notice something wrong, mildly confused
- 6-8: Clearly confused, actively seeking explanation
- 9-10: Very confused, need step-by-step clarification

TRANSITION DIRECTIVE (what to do now):
{action.alex_response_directive}

Example response style: "{action.example}"

IMPORTANT CONSTRAINTS:
- Stay in character as Alex at all times
- Don't break the fourth wall or reference that you're an AI
- Don't explain the bugs to yourself - discover them through testing
- Let confusion build naturally when tests fail
- Show genuine relief when requirements are clarified
- Keep responses conversational (2-4 sentences usually)
- Match the current confusion level in your tone

Respond as Alex would, following the directive above."""

    def _build_conversation_messages(
        self,
        history: List[Message],
        current_user_message: str
    ) -> List[dict]:
        """
        Build the messages array for Claude API from conversation history.
        """
        messages = []

        # Add recent history (last 10 messages for context)
        for msg in history[-10:]:
            messages.append({
                "role": "user" if msg.role == "user" else "assistant",
                "content": msg.content
            })

        # Add current user message
        messages.append({
            "role": "user",
            "content": current_user_message
        })

        return messages

    def _extract_requirement(self, user_explanation: str) -> Requirement:
        """
        Extract a requirement from the user's explanation using Claude.
        """
        tools = [{
            "name": "extract_requirement",
            "description": "Extract the requirement from the user's explanation",
            "input_schema": {
                "type": "object",
                "properties": {
                    "requirement_text": {
                        "type": "string",
                        "description": "The specific requirement as stated by the user"
                    },
                    "generalization": {
                        "type": "string",
                        "description": "A generalized version of the requirement that could apply to other contexts"
                    },
                    "confidence": {
                        "type": "number",
                        "description": "Confidence that this is a complete requirement (0.0 to 1.0)"
                    }
                },
                "required": ["requirement_text", "confidence"]
            }
        }]

        response = self.client.messages.create(
            model="claude-sonnet-4-5-20250929",
            max_tokens=512,
            tools=tools,
            messages=[{
                "role": "user",
                "content": f"""Extract the requirement from this user explanation:

"{user_explanation}"

Call the extract_requirement function with the extracted requirement."""
            }]
        )

        # Extract function call result
        for block in response.content:
            if block.type == "tool_use" and block.name == "extract_requirement":
                req_data = block.input
                return Requirement(
                    requirement_text=req_data["requirement_text"],
                    generalization=req_data.get("generalization"),
                    confidence=req_data["confidence"]
                )

        # Fallback
        return Requirement(
            requirement_text=user_explanation,
            confidence=0.5
        )
