"""
State Service - Manages intervention state persistence with Supabase.
Handles CRUD operations for sessions, messages, and state snapshots.
"""

from typing import List, Dict, Any, Optional
from datetime import datetime
import json
from supabase import Client

from ..models import InterventionState, Requirement, Message


class StateService:
    """Manages state persistence for intervention sessions."""

    def __init__(self, supabase_client: Client):
        self.db = supabase_client

    def create_session(self, user_id: str = "anonymous") -> InterventionState:
        """Create a new intervention session."""
        # Insert session record
        result = self.db.table("intervention_sessions").insert({
            "user_id": user_id,
            "current_phase": "charter_construction",
            "confusion_level": 0,
            "dimensions_identified": 0,
            "requirements_surfaced": 0,
            "tests_executed": 0,
            "metadata": {}
        }).execute()

        session_id = result.data[0]["id"]

        # Create initial state
        state = InterventionState(
            session_id=session_id,
            phase="charter_construction",
            confusion_level=0
        )

        # Save initial state snapshot
        self._save_state_snapshot(state)

        return state

    def get_state(self, session_id: str) -> InterventionState:
        """Load current state for a session."""
        # Get session record
        session_result = self.db.table("intervention_sessions").select("*").eq("id", session_id).execute()

        if not session_result.data:
            raise ValueError(f"Session {session_id} not found")

        session = session_result.data[0]

        # Get latest state snapshot
        state_result = self.db.table("intervention_state").select("*").eq("session_id", session_id).order("snapshot_at", desc=True).limit(1).execute()

        if state_result.data:
            state_data = state_result.data[0]
            return InterventionState(
                session_id=session_id,
                phase=state_data["phase"],
                dimensions_identified=state_data["dimensions_identified"] or [],
                dimensions_pending=state_data["dimensions_pending"] or [],
                requirements_surfaced=[
                    Requirement(**req) for req in (state_data["requirements"] or [])
                ],
                confusion_level=state_data["confusion_level"],
                tests_executed=self._get_tests_executed(session_id),
                message_count=self._get_message_count(session_id),
                premature_test_attempts=state_data["premature_test_attempts"],
                predictions_skipped=state_data["predictions_skipped"],
                last_transition=state_data["last_transition"]
            )
        else:
            # No state snapshot yet, return initial state
            return InterventionState(
                session_id=session_id,
                phase=session["current_phase"],
                confusion_level=session["confusion_level"]
            )

    def update_state(self, session_id: str, updates: Dict[str, Any]) -> InterventionState:
        """Update state with partial changes."""
        # Get current state
        state = self.get_state(session_id)

        # Apply updates
        for key, value in updates.items():
            if hasattr(state, key):
                setattr(state, key, value)

        # Update session record
        session_updates = {}
        if "phase" in updates:
            session_updates["current_phase"] = updates["phase"]
        if "confusion_level" in updates:
            session_updates["confusion_level"] = updates["confusion_level"]
        if "dimensions_identified" in updates:
            session_updates["dimensions_identified"] = len(updates["dimensions_identified"])
        if "requirements_surfaced" in updates:
            session_updates["requirements_surfaced"] = len(updates["requirements_surfaced"])
        if "tests_executed" in updates:
            session_updates["tests_executed"] = len(updates["tests_executed"])

        if session_updates:
            self.db.table("intervention_sessions").update(session_updates).eq("id", session_id).execute()

        # Save state snapshot
        self._save_state_snapshot(state)

        return state

    def transition_phase(self, session_id: str, new_phase: str, rule_name: str):
        """Transition to a new phase."""
        state = self.get_state(session_id)
        old_phase = state.phase

        # Update state
        state = self.update_state(session_id, {
            "phase": new_phase,
            "last_transition": rule_name
        })

        # Log transition
        self.db.table("intervention_transitions").insert({
            "session_id": session_id,
            "rule_name": rule_name,
            "from_phase": old_phase,
            "to_phase": new_phase
        }).execute()

        return state

    def add_dimension(self, session_id: str, dimension: str) -> InterventionState:
        """Add a newly identified dimension."""
        state = self.get_state(session_id)

        if dimension not in state.dimensions_identified:
            state.dimensions_identified.append(dimension)
            return self.update_state(session_id, {
                "dimensions_identified": state.dimensions_identified
            })

        return state

    def add_requirement(self, session_id: str, requirement: Requirement) -> InterventionState:
        """Add a newly surfaced requirement."""
        state = self.get_state(session_id)
        state.requirements_surfaced.append(requirement)

        # Save to requirements table
        self.db.table("intervention_requirements_surfaced").insert({
            "session_id": session_id,
            "requirement_text": requirement.requirement_text,
            "generalization": requirement.generalization,
            "confidence": requirement.confidence
        }).execute()

        return self.update_state(session_id, {
            "requirements_surfaced": state.requirements_surfaced
        })

    def increment_confusion(self, session_id: str, delta: int) -> InterventionState:
        """Increment confusion level (clamped to 0-10)."""
        state = self.get_state(session_id)
        new_level = max(0, min(10, state.confusion_level + delta))

        return self.update_state(session_id, {
            "confusion_level": new_level
        })

    def save_message(self, session_id: str, role: str, content: str, metadata: Dict[str, Any] = None) -> Message:
        """Save a conversation message."""
        sequence_number = self._get_message_count(session_id) + 1

        message_data = {
            "session_id": session_id,
            "role": role,
            "content": content,
            "sequence_number": sequence_number,
            "metadata": metadata or {}
        }

        if metadata and "confusion_level" in metadata:
            message_data["confusion_level"] = metadata["confusion_level"]
        if metadata and "transition_rule_fired" in metadata:
            message_data["transition_rule_fired"] = metadata["transition_rule_fired"]

        result = self.db.table("intervention_messages").insert(message_data).execute()

        return Message(
            role=role,
            content=content,
            timestamp=datetime.now(),
            confusion_level=metadata.get("confusion_level") if metadata else None,
            transition_rule_fired=metadata.get("transition_rule_fired") if metadata else None,
            metadata=metadata or {}
        )

    def get_conversation_history(self, session_id: str, limit: int = 10) -> List[Message]:
        """Get recent conversation messages."""
        result = self.db.table("intervention_messages").select("*").eq("session_id", session_id).order("sequence_number", desc=True).limit(limit).execute()

        messages = []
        for msg_data in reversed(result.data):
            messages.append(Message(
                role=msg_data["role"],
                content=msg_data["content"],
                timestamp=datetime.fromisoformat(msg_data["timestamp"]),
                confusion_level=msg_data.get("confusion_level"),
                transition_rule_fired=msg_data.get("transition_rule_fired"),
                metadata=msg_data.get("metadata", {})
            ))

        return messages

    def save_test_execution(self, session_id: str, test_case: Dict[str, Any], user_prediction: str, actual_outcome: str, passed: bool, bugs_triggered: List[str], simulation_results: Dict[str, Any]):
        """Save a test execution record."""
        self.db.table("intervention_tests_executed").insert({
            "session_id": session_id,
            "test_case": test_case,
            "user_prediction": user_prediction,
            "actual_outcome": actual_outcome,
            "passed": passed,
            "bugs_triggered": bugs_triggered,
            "simulation_results": simulation_results
        }).execute()

    def _save_state_snapshot(self, state: InterventionState):
        """Save a state snapshot for debugging/analysis."""
        self.db.table("intervention_state").insert({
            "session_id": state.session_id,
            "phase": state.phase,
            "dimensions_identified": state.dimensions_identified,
            "dimensions_pending": state.dimensions_pending,
            "requirements": [req.dict() for req in state.requirements_surfaced],
            "confusion_level": state.confusion_level,
            "premature_test_attempts": state.premature_test_attempts,
            "predictions_skipped": state.predictions_skipped,
            "last_transition": state.last_transition
        }).execute()

    def _get_message_count(self, session_id: str) -> int:
        """Get total message count for a session."""
        result = self.db.table("intervention_messages").select("id", count="exact").eq("session_id", session_id).execute()
        return result.count or 0

    def _get_tests_executed(self, session_id: str) -> List[Dict[str, Any]]:
        """Get all tests executed in this session."""
        result = self.db.table("intervention_tests_executed").select("*").eq("session_id", session_id).order("executed_at", desc=False).execute()
        return result.data or []
