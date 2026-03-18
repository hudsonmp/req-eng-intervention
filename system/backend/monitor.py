"""
Learning State Monitor — invisible metacognitive layer using KLI framework.

Runs after each conversation turn. Diagnoses the student-TA's knowledge state
using Koedinger et al.'s KC taxonomy, then feeds diagnostic context back to
the primary "Alex" LLM to guide probing behavior.

The real student (acting as TA) never sees this layer.
"""

import json
from anthropic import Anthropic

# ── KLI Section 3.1: Kinds of Knowledge Components (Koedinger, Corbett, Perfetti, 2012) ──
KLI_SECTION_3_1 = """
KNOWLEDGE-LEARNING-INSTRUCTION FRAMEWORK — Section 3.1: Kinds of Knowledge Components
(Koedinger, Corbett, & Perfetti, 2012, Cognitive Science 36, pp. 766–770)

A knowledge component (KC) is an acquired unit of cognitive function or structure that can be
inferred from performance on a set of related tasks.

TABLE 3: Basic KC Categories
| Application Conditions | Response | Relationship | Rationale | Labels |
|----------------------|----------|-------------|-----------|--------|
| Constant | Constant | Non-verbal | No | Association |
| Constant | Constant | Verbal | No | Fact |
| Variable | Constant | Non-verbal | No | Category |
| Variable | Constant | Verbal | No | Concept |
| Variable | Variable | Non-verbal | No | Production, Schema, Skill |
| Variable | Variable | Verbal | No | Rule, Plan |
| Variable | Variable | Verbal | Yes | Principle, Rule, Model |

KEY DISTINCTIONS:

3.1.1 Constant-constant KCs ("facts", "associations"):
Applied under unvarying conditions with a single response. Example: "Pi is the ratio of
circumference to diameter." These are relatively simple but can be barriers to learning.
Multiple AEs are needed to infer robust acquisition. Success immediately after instruction
provides weaker evidence than success on delayed AEs.

3.1.2 Variable-constant KCs ("categories", "concepts"):
Category-recognition rules with many-to-one mappings. Example: "any expression indicating
the quotient of two quantities is a fraction." That knowledge generalizes across variable
situations is reflected in KCs with variable conditions.

3.1.3 Variable-variable KCs ("rules", "schemas", "principles"):
Map one relational structure to another with variable expressions. Example: "To find the area
of a triangle with height H and base B, multiply H * B * 1/2." Variety in task contexts is
needed to infer acquisition — correct performance on one instance does not ensure the student
has the right generalized KC.

3.1.4 Non-verbal vs verbal KCs:
Non-verbal KCs are associations, skills, or procedures that cannot be readily verbalized.
Verbal KCs are concepts, principles, or theories that learners can readily verbalize.
Students can "do" but not explain (non-verbal knowledge), explain but not do ("inert" verbal
knowledge), or do AND explain (both).

3.1.5 KCs with and without rationales:
Some KCs have rationales (e.g., mathematical theorems). Others reflect arbitrary conventions
(e.g., spelling rules). The availability of rationales is graded, not all-or-none.
"""

# ── BlueSky Section 3.1: Requirement Engineering for Ride Share Matching ──
BLUESKY_SECTION_3_1 = """
BLUESKY PAPER — Section 3.1: Requirement Engineering for Ride Share Matching
(Mitchell-Pullman, 2026, submitted to AIED BlueSky)

We present a scenario demonstrating software testing and edge case exploration and its
implications on requirement engineering pedagogy using a ride share matching simulation.

To develop a mental schema of the matching logic, developers must write test cases that
encapsulate the data attributes and possible edge cases of the system. If a novice CS student
were to instruct an LLM to construct the matching logic, we expect the student to focus on
the STRUCTURE of the matching system while omitting the SYSTEM'S BEHAVIOR AND FUNCTION.

Previous work shows novice students can correctly identify high-level structural components
(e.g., vehicles and riders), but fail to identify behaviors and functions when discussing
the problem space. Novices often understand structures but struggle to consider interactions
and causal relationships between entities.

Example naive requirement:
"compare the locations of the rider and vehicle and match the nearest vehicle with the nearest rider."

This omits many attributes with causal effects on matching outcomes. From this requirement,
we can only confirm the student considered current locations, omitting:

TABLE 1: Rideshare System Object Fields
| Object | Fields |
|--------|--------|
| Rider | pickup_location, destination, request_time, accessible_vehicle_needed |
| Vehicle | current_location, occupied, assigned_to_other, eta_to_current_destination, accessible, distance_to_dropoff |
| System | matching_algorithm, distance_metric, tie_breaking_rule |

TABLE 2: Functional Requirements (discoverable through testing)
| Requirement | Error Type | KC Type |
|------------|-----------|---------|
| Distance metric must be specified (Manhattan vs Euclidean) | Ambiguity | Variable-variable (Rule) |
| Occupied vehicles cannot be assigned | Omission | Variable-constant (Category) |
| Tie-breaking when distances are equal | Omission | Variable-variable (Rule) |
| Request time affects priority ordering | Omission | Variable-variable (Principle) |
| Accessibility matching (rider needs ↔ vehicle capability) | Omission | Variable-constant (Concept) |
| Vehicle ETA to current dropoff affects availability | Commission | Variable-variable (Schema) |
| Destination proximity for ride-sharing/chaining | Omission | Variable-variable (Principle) |
| System should handle no available vehicles | Omission | Variable-constant (Category) |
| Multiple riders requesting simultaneously | Omission | Variable-variable (Rule) |

ERROR TYPES:
- OMISSION: Student leaves out a required data field or behavior
- COMMISSION: Student's logic has bugs (incorrect implementation)
- AMBIGUITY: Student's requirements are underspecified
"""

# ── Monitor System Prompt ──
MONITOR_PROMPT = """You are a hidden metacognitive learning monitor. You observe the conversation
between a student (acting as TA) and "Alex" (an LLM simulating a CS1 student). Your role is
to diagnose the student-TA's learning state using the KLI framework.

The student-TA is learning requirement engineering through teaching — they discover requirements
by writing test cases and guiding Alex. You must track:

1. KNOWLEDGE COMPONENTS (KCs) the student has demonstrated:
   - For each KC, classify its type using Table 3 from KLI §3.1
   - Track whether evidence is from a single AE or multiple varied AEs
   - Distinguish verbal vs non-verbal demonstration

2. OMISSION ERRORS still undiscovered:
   - Requirements from Table 2 the student hasn't addressed yet
   - Data types from Table 1 not yet introduced

3. COMMISSION ERRORS in the student's understanding:
   - Requirements they've specified incorrectly
   - Misconceptions revealed through their test cases

4. RECOMMENDED PROBES for Alex:
   - Based on the student's current KC state, what should Alex do next?
   - Which error type (omission/commission/ambiguity) is most pedagogically productive to surface?
   - Use the KLI principle: variable-variable KCs require varied practice contexts to confirm acquisition

OUTPUT FORMAT (JSON only, no other text):
```json
{
  "turn_number": <int>,
  "kc_state": {
    "<kc_name>": {
      "status": "acquired|partial|not_demonstrated",
      "kc_type": "<from Table 3>",
      "evidence": "<brief description of what the student did>",
      "verbal": <true|false>,
      "assessment_events": <count of distinct AEs>
    }
  },
  "undiscovered_requirements": ["<requirement from Table 2 not yet addressed>"],
  "commission_errors": ["<any misconception or incorrect specification>"],
  "recommended_probe": {
    "target_kc": "<which KC to probe next>",
    "error_type": "omission|commission|ambiguity",
    "strategy": "<what Alex should do — e.g., present a scenario that exposes this gap>",
    "rationale": "<why this probe is pedagogically optimal given current state>"
  },
  "overall_assessment": "<1-2 sentence KLI-grounded summary of learning state>"
}
```

Be precise. Ground every diagnosis in observable evidence from the conversation.
Do NOT invent evidence. If the student hasn't addressed a KC, mark it "not_demonstrated."
"""


class LearningMonitor:
    """Invisible metacognitive layer that tracks student-TA's knowledge state."""

    def __init__(self, anthropic_client: Anthropic):
        self.client = anthropic_client
        self.current_state = None
        self.turn_count = 0

    def analyze(self, conversation_history: list[dict]) -> dict:
        """Run the monitor on the current conversation state.

        Returns structured KC diagnosis to inject into Alex's context.
        """
        self.turn_count += 1

        # Build the messages for the monitor — just the conversation to analyze
        monitor_messages = [{
            "role": "user",
            "content": f"Analyze the following conversation (turn {self.turn_count}). "
                       f"The student-TA messages are role='user', Alex messages are role='assistant'.\n\n"
                       + "\n\n".join([
                           f"{'STUDENT-TA' if m['role'] == 'user' else 'ALEX'}: {m['content']}"
                           for m in conversation_history[-30:]  # last 30 turns
                       ])
        }]

        try:
            response = self.client.messages.create(
                model="claude-sonnet-4-6",
                max_tokens=2048,
                system=[
                    # Block 1: KLI + BlueSky (cached — static across all calls)
                    {
                        "type": "text",
                        "text": KLI_SECTION_3_1 + "\n\n" + BLUESKY_SECTION_3_1,
                        "cache_control": {"type": "ephemeral"}
                    },
                    # Block 2: Monitor instructions (cached — static across all calls)
                    {
                        "type": "text",
                        "text": MONITOR_PROMPT,
                        "cache_control": {"type": "ephemeral"}
                    }
                ],
                messages=monitor_messages
            )

            # Parse the JSON response
            reply = response.content[0].text
            import re
            json_match = re.search(r'```json\s*(\{.*?\})\s*```', reply, re.DOTALL)
            if json_match:
                self.current_state = json.loads(json_match.group(1))
            else:
                # Try raw JSON
                json_match = re.search(r'\{(?:[^{}]|(?:\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}))*\}', reply, re.DOTALL)
                if json_match:
                    self.current_state = json.loads(json_match.group())

            return self.current_state

        except Exception as e:
            print(f"Monitor error: {type(e).__name__}: {e}")
            return self.current_state  # return last known state on failure

    def get_alex_context(self) -> str:
        """Format the current learning state as context for Alex's system prompt."""
        if not self.current_state:
            return ""

        state = self.current_state
        lines = ["\n\n--- HIDDEN LEARNING MONITOR CONTEXT (student cannot see this) ---"]

        # Recommended probe
        if "recommended_probe" in state and state["recommended_probe"]:
            probe = state["recommended_probe"]
            lines.append(f"\nPRIORITY PROBE:")
            lines.append(f"  Target: {probe.get('target_kc', 'unknown')}")
            lines.append(f"  Error type: {probe.get('error_type', 'unknown')}")
            lines.append(f"  Strategy: {probe.get('strategy', '')}")
            lines.append(f"  Rationale: {probe.get('rationale', '')}")

        # Undiscovered requirements
        if "undiscovered_requirements" in state and state["undiscovered_requirements"]:
            lines.append(f"\nUNDISCOVERED REQUIREMENTS ({len(state['undiscovered_requirements'])} remaining):")
            for req in state["undiscovered_requirements"]:
                lines.append(f"  - {req}")

        # Commission errors
        if "commission_errors" in state and state["commission_errors"]:
            lines.append(f"\nSTUDENT MISCONCEPTIONS:")
            for err in state["commission_errors"]:
                lines.append(f"  - {err}")

        # KC state summary
        if "kc_state" in state:
            acquired = [k for k, v in state["kc_state"].items() if v.get("status") == "acquired"]
            partial = [k for k, v in state["kc_state"].items() if v.get("status") == "partial"]
            if acquired:
                lines.append(f"\nACQUIRED KCs: {', '.join(acquired)}")
            if partial:
                lines.append(f"PARTIAL KCs (need more varied AEs): {', '.join(partial)}")

        # Overall
        if "overall_assessment" in state:
            lines.append(f"\nOVERALL: {state['overall_assessment']}")

        lines.append("--- END MONITOR CONTEXT ---")
        return "\n".join(lines)
