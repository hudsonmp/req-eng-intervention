"""
FastAPI server for the intervention system.
Provides WebSocket endpoint for real-time chat with Alex.
"""

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from supabase import create_client, Client
import os
import json
from dotenv import load_dotenv
from typing import Dict

from ..services.state_service import StateService
from ..services.transition_engine import TransitionEngine
from ..services.claude_service import ClaudeService
from ..services.simulation_service import SimulationService
from ..models import InterventionState, TestCase

# Load environment variables
load_dotenv()

# Initialize FastAPI app
app = FastAPI(title="Intervention System API")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],  # React + Vite
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize services
supabase: Client = create_client(
    os.getenv("SUPABASE_URL"),
    os.getenv("SUPABASE_KEY")
)
state_service = StateService(supabase)
transition_engine = TransitionEngine(os.getenv("ANTHROPIC_API_KEY"))
claude_service = ClaudeService(os.getenv("ANTHROPIC_API_KEY"))
simulation_service = SimulationService()

# Track active WebSocket connections
active_connections: Dict[str, WebSocket] = {}


@app.get("/")
async def root():
    """Health check endpoint."""
    return {"status": "ok", "service": "intervention-system"}


@app.post("/api/sessions")
async def create_session():
    """Create a new intervention session."""
    try:
        state = state_service.create_session(user_id="anonymous")

        # Send initial Alex message
        initial_message = (
            "Hey! I built a vehicle matching system for a ride-sharing app. "
            "I think it works, but I want to make sure I tested it properly. "
            "Can you help me figure out what we should test?"
        )

        state_service.save_message(
            session_id=state.session_id,
            role="alex",
            content=initial_message,
            metadata={"confusion_level": 0}
        )

        return {
            "id": state.session_id,
            "initial_message": initial_message,
            "state": state.to_dict()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/sessions/{session_id}")
async def get_session(session_id: str):
    """Get session details and current state."""
    try:
        state = state_service.get_state(session_id)
        history = state_service.get_conversation_history(session_id, limit=50)

        return {
            "session_id": session_id,
            "state": state.to_dict(),
            "messages": [
                {
                    "role": msg.role,
                    "content": msg.content,
                    "timestamp": msg.timestamp.isoformat(),
                    "confusion_level": msg.confusion_level
                }
                for msg in history
            ]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.websocket("/ws/chat/{session_id}")
async def chat_websocket(websocket: WebSocket, session_id: str):
    """
    WebSocket endpoint for real-time chat with Alex.
    """
    await websocket.accept()
    active_connections[session_id] = websocket

    try:
        while True:
            # Receive user message
            data = await websocket.receive_text()
            user_message = data

            # Load current state
            state = state_service.get_state(session_id)

            # Evaluate transition - which rule fires?
            action = transition_engine.evaluate(state, user_message)

            # Get conversation history for context
            conversation_history = state_service.get_conversation_history(
                session_id, limit=10
            )

            # Generate Alex's response
            alex_response = claude_service.generate_response(
                user_message, state, action, conversation_history
            )

            # Handle test execution if needed
            test_result = None
            if action.should_execute_test:
                # Try to extract test case from user message
                # For now, we'll need to parse it or have the user provide structured input
                # This is a simplified version - in production, we'd use Claude to extract test details
                try:
                    # Placeholder: In real implementation, parse test case from message
                    # For now, just indicate test was requested
                    alex_response.message += "\n\n[Test execution would happen here - needs structured test input]"
                except Exception as e:
                    alex_response.message += f"\n\n[Error executing test: {str(e)}]"

            # Handle dimension identification
            if action.rule_name == "acknowledge_dimension":
                # Extract dimension from the transition engine's analysis
                # This would be passed through the action or extracted separately
                # For now, we'll update state in the next step
                pass

            # Update state based on action
            state_updates = {
                "confusion_level": state.confusion_level + action.confusion_delta,
                "last_transition": action.rule_name,
                "message_count": state.message_count + 1
            }

            # Handle phase transitions
            if action.phase_transition:
                state = state_service.transition_phase(
                    session_id, action.phase_transition, action.rule_name
                )
                state_updates["phase"] = action.phase_transition

            # Save requirement if crystallized
            if alex_response.requirement_crystallized:
                state = state_service.add_requirement(
                    session_id, alex_response.requirement_crystallized
                )

            # Update state
            state = state_service.update_state(session_id, state_updates)

            # Save messages
            state_service.save_message(session_id, "user", user_message, {})
            state_service.save_message(
                session_id,
                "alex",
                alex_response.message,
                {
                    "confusion_level": state.confusion_level,
                    "transition_rule_fired": action.rule_name
                }
            )

            # Send response to client
            await websocket.send_json({
                "role": "alex",
                "content": alex_response.message,
                "state": state.to_dict(),
                "metadata": {
                    "rule_fired": action.rule_name,
                    "confusion_level": state.confusion_level,
                    "phase": state.phase
                }
            })

    except WebSocketDisconnect:
        if session_id in active_connections:
            del active_connections[session_id]
    except Exception as e:
        await websocket.send_json({
            "role": "system",
            "content": f"Error: {str(e)}",
            "error": True
        })
        await websocket.close()
        if session_id in active_connections:
            del active_connections[session_id]


@app.post("/api/sessions/{session_id}/execute-test")
async def execute_test(session_id: str, test_case: dict):
    """
    Execute a test case with bug injection.
    Separate endpoint for structured test execution.
    """
    try:
        # Load state
        state = state_service.get_state(session_id)

        # Convert to TestCase model
        test = TestCase(**test_case)

        # Execute test
        result = simulation_service.execute_test(test, bug_level='primary')

        # Save test execution
        state_service.save_test_execution(
            session_id=session_id,
            test_case=test_case,
            user_prediction=test_case.get('expected_outcome', ''),
            actual_outcome=result.actual_outcome,
            passed=result.passed,
            bugs_triggered=result.bugs_triggered,
            simulation_results=result.simulation_results
        )

        # Update state
        state_service.update_state(session_id, {
            "tests_executed": state.tests_executed + [test_case]
        })

        # If test failed, increase confusion
        if not result.passed:
            state_service.increment_confusion(session_id, delta=2)

        return {
            "test_case": test_case,
            "actual_outcome": result.actual_outcome,
            "passed": result.passed,
            "bugs_triggered": result.bugs_triggered
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
