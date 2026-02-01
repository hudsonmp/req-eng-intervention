"""
Transition Engine - Rule-based pedagogical state machine.
Evaluates which transition rule fires given current state and user message.
"""

from typing import List, Callable
from ..models import InterventionState, MessageAnalysis, Action
import anthropic
import json
import os


class TransitionRule:
    """Represents a single transition rule."""

    def __init__(
        self,
        name: str,
        priority: int,
        condition: Callable[[InterventionState, MessageAnalysis], bool],
        action: Action
    ):
        self.name = name
        self.priority = priority
        self.condition = condition
        self.action = action

    def evaluate(self, state: InterventionState, analysis: MessageAnalysis) -> bool:
        """Check if this rule's condition is met."""
        return self.condition(state, analysis)


class TransitionEngine:
    """Evaluates transition rules and determines pedagogical actions."""

    def __init__(self, anthropic_api_key: str):
        self.client = anthropic.Anthropic(api_key=anthropic_api_key)
        self.rules = self._define_rules()

    def evaluate(self, state: InterventionState, user_message: str) -> Action:
        """
        Evaluate which rule fires for the current state and user message.
        Returns the action to take.
        """
        # Analyze user message with Claude
        message_analysis = self._analyze_message(user_message, state)

        # Check rules in priority order
        for rule in sorted(self.rules, key=lambda r: r.priority, reverse=True):
            if rule.evaluate(state, message_analysis):
                return rule.action

        # Default action if no rules fire
        return self._default_action(state)

    def _analyze_message(self, message: str, state: InterventionState) -> MessageAnalysis:
        """
        Use Claude to analyze user message intent using function calling.
        Extracts: test proposals, predictions, explanations, dimensions, etc.
        """
        tools = [{
            "name": "analyze_user_message",
            "description": "Analyze the user's message to extract intent and content",
            "input_schema": {
                "type": "object",
                "properties": {
                    "proposes_test": {
                        "type": "boolean",
                        "description": "Does the user propose a specific test case?"
                    },
                    "includes_prediction": {
                        "type": "boolean",
                        "description": "Does the user state what they expect to happen?"
                    },
                    "attempts_explanation": {
                        "type": "boolean",
                        "description": "Does the user try to explain why something happened?"
                    },
                    "suggests_dimension": {
                        "type": "boolean",
                        "description": "Does the user mention a testable dimension (proximity, availability, state)?"
                    },
                    "suggests_generalization": {
                        "type": "boolean",
                        "description": "Does the user suggest a general principle or pattern?"
                    },
                    "dimension_mentioned": {
                        "type": "string",
                        "description": "The specific dimension mentioned (e.g., 'proximity', 'availability', 'state_update')"
                    },
                    "explanation_text": {
                        "type": "string",
                        "description": "The user's explanation of why something happened"
                    },
                    "generalization_text": {
                        "type": "string",
                        "description": "The general principle the user articulates"
                    },
                    "test_case": {
                        "type": "object",
                        "description": "The test case proposed by the user",
                        "properties": {
                            "vehicles": {"type": "array"},
                            "riders": {"type": "array"},
                            "expected_outcome": {"type": "string"}
                        }
                    }
                },
                "required": ["proposes_test", "includes_prediction", "attempts_explanation", "suggests_dimension", "suggests_generalization"]
            }
        }]

        response = self.client.messages.create(
            model="claude-sonnet-4-5-20250929",
            max_tokens=1024,
            tools=tools,
            messages=[{
                "role": "user",
                "content": f"""Analyze this user message in the context of a pedagogical conversation about testing code.

Current phase: {state.phase}
Dimensions already identified: {state.dimensions_identified}

User message: "{message}"

Call the analyze_user_message function with your analysis."""
            }]
        )

        # Extract function call result
        for block in response.content:
            if block.type == "tool_use" and block.name == "analyze_user_message":
                analysis_data = block.input
                return MessageAnalysis(**analysis_data)

        # Fallback if no function call
        return MessageAnalysis()

    def _define_rules(self) -> List[TransitionRule]:
        """Define all pedagogical transition rules."""
        rules = []

        # ============================================================
        # PHASE 1: CHARTER CONSTRUCTION RULES
        # ============================================================

        # Rule: Scaffold premature test
        rules.append(TransitionRule(
            name="scaffold_premature_test",
            priority=10,
            condition=lambda state, analysis: (
                state.phase == "charter_construction" and
                analysis.proposes_test and
                len(state.dimensions_identified) < 2
            ),
            action=Action(
                rule_name="scaffold_premature_test",
                alex_response_directive=(
                    "Gently redirect to dimension exploration. "
                    "Express uncertainty about what to test. "
                    "Ask what aspects of the system should be checked first."
                ),
                example=(
                    "Hmm, before we jump into testing specific cases, "
                    "maybe we should think about what aspects we need to check? "
                    "Like... what makes a good vehicle assignment?"
                ),
                priority=10,
                confusion_delta=1
            )
        ))

        # Rule: Acknowledge dimension
        rules.append(TransitionRule(
            name="acknowledge_dimension",
            priority=9,
            condition=lambda state, analysis: (
                state.phase == "charter_construction" and
                analysis.suggests_dimension and
                analysis.dimension_mentioned not in state.dimensions_identified
            ),
            action=Action(
                rule_name="acknowledge_dimension",
                alex_response_directive=(
                    "Enthusiastically acknowledge the dimension. "
                    "Add it to dimensions_identified (handled by orchestrator). "
                    "Ask about other dimensions to explore."
                ),
                example=(
                    "Right, proximity! That's definitely important. "
                    "What else should we check? Are there other factors that matter?"
                ),
                priority=9
            )
        ))

        # Rule: Transition to testing
        rules.append(TransitionRule(
            name="transition_to_testing",
            priority=8,
            condition=lambda state, analysis: (
                state.phase == "charter_construction" and
                len(state.dimensions_identified) >= 2 and
                analysis.proposes_test
            ),
            action=Action(
                rule_name="transition_to_testing",
                alex_response_directive=(
                    "Agree to start testing. "
                    "Show readiness to execute the test. "
                    "Transition to test_execution phase."
                ),
                example=(
                    "Okay, we've identified proximity and availability. "
                    "Let's start testing! What test should we run first?"
                ),
                priority=8,
                phase_transition="test_execution"
            )
        ))

        # ============================================================
        # PHASE 2: TEST EXECUTION RULES
        # ============================================================

        # Rule: Force prediction
        rules.append(TransitionRule(
            name="force_prediction",
            priority=10,
            condition=lambda state, analysis: (
                state.phase == "test_execution" and
                analysis.proposes_test and
                not analysis.includes_prediction
            ),
            action=Action(
                rule_name="force_prediction",
                alex_response_directive=(
                    "Don't run the test yet. "
                    "Ask the user what they expect to happen first. "
                    "Show curiosity about their prediction."
                ),
                example=(
                    "Before I run this, what do you think should happen? "
                    "Which vehicle should be assigned?"
                ),
                priority=10
            )
        ))

        # Rule: Execute test
        rules.append(TransitionRule(
            name="execute_test",
            priority=9,
            condition=lambda state, analysis: (
                state.phase == "test_execution" and
                analysis.proposes_test and
                analysis.includes_prediction
            ),
            action=Action(
                rule_name="execute_test",
                alex_response_directive=(
                    "Acknowledge the prediction. "
                    "Execute the test (orchestrator will handle). "
                    "Report the actual outcome."
                ),
                example=(
                    "Okay, you expect Vehicle A to be assigned. Let me run this... "
                    "[Test executes] "
                    "The result is: [actual outcome]"
                ),
                priority=9,
                should_execute_test=True
            )
        ))

        # Rule: Express confusion on test failure
        rules.append(TransitionRule(
            name="express_confusion",
            priority=8,
            condition=lambda state, analysis: (
                state.phase == "test_execution" and
                state.confusion_level > 0 and
                state.confusion_level < 5 and
                not analysis.attempts_explanation
            ),
            action=Action(
                rule_name="express_confusion",
                alex_response_directive=(
                    "Express genuine confusion about the unexpected result. "
                    "Ask why this happened. "
                    "Show you don't understand."
                ),
                example=(
                    "Wait, that's weird... I thought Vehicle B would be assigned. "
                    "Why did Vehicle A get picked instead?"
                ),
                priority=8,
                confusion_delta=1
            )
        ))

        # Rule: Probe for deeper explanation
        rules.append(TransitionRule(
            name="probe_explanation",
            priority=8,
            condition=lambda state, analysis: (
                state.phase == "test_execution" and
                analysis.attempts_explanation and
                state.confusion_level >= 5 and
                state.confusion_level < 8
            ),
            action=Action(
                rule_name="probe_explanation",
                alex_response_directive=(
                    "The explanation is on the right track. "
                    "Ask a deeper question about the mechanism. "
                    "Show you're starting to understand but need more detail."
                ),
                example=(
                    "So you're saying the availability flag isn't being updated? "
                    "Where in my code should that happen?"
                ),
                priority=8,
                confusion_delta=1
            )
        ))

        # Rule: Crystallize requirement
        rules.append(TransitionRule(
            name="crystallize_requirement",
            priority=10,
            condition=lambda state, analysis: (
                state.phase == "test_execution" and
                analysis.attempts_explanation and
                state.confusion_level >= 7
            ),
            action=Action(
                rule_name="crystallize_requirement",
                alex_response_directive=(
                    "Show understanding dawning. "
                    "Restate the requirement clearly. "
                    "Confirm this is what needs to be fixed. "
                    "Reduce confusion significantly."
                ),
                example=(
                    "Ohh, I get it now! So the requirement is: "
                    "when I assign a vehicle, I need to immediately set is_available = False. "
                    "That makes sense!"
                ),
                priority=10,
                confusion_delta=-5,
                should_save_requirement=True
            )
        ))

        # Rule: Suggest another test
        rules.append(TransitionRule(
            name="suggest_another_test",
            priority=6,
            condition=lambda state, analysis: (
                state.phase == "test_execution" and
                state.confusion_level < 3 and
                len(state.requirements_surfaced) > 0
            ),
            action=Action(
                rule_name="suggest_another_test",
                alex_response_directive=(
                    "Suggest testing another dimension or edge case. "
                    "Show curiosity about whether other parts work correctly."
                ),
                example=(
                    "That test worked! Should we test something else? "
                    "What about when a ride ends - does availability get restored?"
                ),
                priority=6
            )
        ))

        # ============================================================
        # PHASE 3: REQUIREMENT SYNTHESIS RULES
        # ============================================================

        # Rule: Transition to synthesis
        rules.append(TransitionRule(
            name="transition_to_synthesis",
            priority=9,
            condition=lambda state, analysis: (
                state.phase == "test_execution" and
                len(state.requirements_surfaced) >= 1 and
                analysis.suggests_generalization
            ),
            action=Action(
                rule_name="transition_to_synthesis",
                alex_response_directive=(
                    "Acknowledge the generalization. "
                    "Transition to synthesis phase. "
                    "Show interest in the broader principle."
                ),
                example=(
                    "That's interesting... so this isn't just about my vehicle code?"
                ),
                priority=9,
                phase_transition="requirement_synthesis"
            )
        ))

        # Rule: Prompt generalization
        rules.append(TransitionRule(
            name="prompt_generalization",
            priority=8,
            condition=lambda state, analysis: (
                state.phase == "requirement_synthesis" and
                len(state.requirements_surfaced) >= 1 and
                not analysis.suggests_generalization
            ),
            action=Action(
                rule_name="prompt_generalization",
                alex_response_directive=(
                    "Ask if this principle applies to other parts of the system. "
                    "Encourage thinking about the general pattern."
                ),
                example=(
                    "Does this availability update thing apply to other parts? "
                    "Like when a vehicle finishes a ride?"
                ),
                priority=8
            )
        ))

        # Rule: Generalize principle
        rules.append(TransitionRule(
            name="generalize_principle",
            priority=9,
            condition=lambda state, analysis: (
                state.phase == "requirement_synthesis" and
                analysis.suggests_generalization
            ),
            action=Action(
                rule_name="generalize_principle",
                alex_response_directive=(
                    "Restate the general principle. "
                    "Show understanding of the transferable concept. "
                    "Suggest how it might apply elsewhere."
                ),
                example=(
                    "So the general rule is: whenever real-world state changes, "
                    "the system representation must be updated immediately. "
                    "That would apply to inventory systems, booking systems, etc."
                ),
                priority=9
            )
        ))

        return rules

    def _default_action(self, state: InterventionState) -> Action:
        """Default action when no rules fire."""
        if state.phase == "charter_construction":
            directive = "Ask what aspects of the system should be tested."
            example = "So... what should we test first?"
        elif state.phase == "test_execution":
            directive = "Acknowledge the input and wait for more direction."
            example = "Okay, what should we do next?"
        else:  # requirement_synthesis
            directive = "Reflect on what we've learned."
            example = "This testing really helped me understand the requirements better!"

        return Action(
            rule_name="default",
            alex_response_directive=directive,
            example=example,
            priority=0
        )
