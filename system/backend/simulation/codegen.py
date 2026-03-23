"""Code generation: send both prompts to Claude, get matching algorithm code."""

import uuid
from anthropic import Anthropic
from .models import CodeSample

CODEGEN_WRAPPER = """Write a Python function with this exact signature:

```python
def match_riders_to_vehicles(riders: list[dict], vehicles: list[dict]) -> list[dict]:
```

**Input format:**
- `riders`: list of dicts, each with keys: "id" (str), "pickup_location" (tuple of 2 ints, 0-29), "dropoff_location" (tuple of 2 ints, 0-29), "request_time" (float, seconds), "party_size" (int), "needs_accessible" (bool)
- `vehicles`: list of dicts, each with keys: "id" (str), "location" (tuple of 2 ints, 0-29), "capacity" (int), "is_occupied" (bool), "is_accessible" (bool), "current_direction" (tuple of 2 ints), "destination" (tuple of 2 ints or None), "assigned_rider" (str or None)

**Output format:**
- Return a list of dicts, each with keys "rider_id" (str) and "vehicle_id" (str), representing assignments.
- Unmatched riders should not appear in the output.

**Domain context (your prompt):**
{user_prompt}

Return ONLY the Python function, no explanation. Use only the standard library (math, itertools, collections are allowed)."""


NOVICE_PROMPT = """You are creating a rideshare matching system that matches autonomous rideshare vehicles with riders via an app. The system must look at the current location of the rider and the current location of the vehicle when the request is made and match the nearest vehicle with the nearest vehicle. Consider all vehicles in the possible matching."""

EXPERT_PROMPT = """You are creating an adaptive rideshare matching system that minimizes the distance, wait time, and travel time of the vehicles and riders. Riders request a ride via an app, and all vehicles are autonomous. When a rider requests a ride, the system should keep track of the time that they requested the ride, their pickup location, drop off location, and the number of people that their ride needs to accommodate. For the vehicle, the system should constantly be tracking the number of seats in the vehicle, the amount of mileage remaining on the vehicle, whether it is currently occupied, the direction it's traveling, and its destination if it's occupied or picking up a passenger. The system should not allow riders to be picked up by a car that is already occupied, but to keep track of which riders need to be matched with a vehicle, the system should assign vehicles to riders, even if the vehicle needs to complete its current ride. The location should be calculated using the weighted sum of the travel time and the manhattan distance, and if a vehicle has a current destination and isn't idle, the distance should be calculated from its destination, not its current location. The system must keep track of vehicle-rider assignments, and must not allow a vehicle to be assigned to more than two different users simultaneously (the current rider and the future rider)."""


def generate_matching_code(
    client: Anthropic,
    prompt: str,
    prompt_type: str,
    n: int = 10,
    model: str = "claude-sonnet-4-6",
    temperature: float = 0.7,
) -> list[CodeSample]:
    """Generate n independent code samples from a prompt."""
    full_prompt = CODEGEN_WRAPPER.format(user_prompt=prompt)
    samples = []

    for i in range(n):
        sample_id = str(uuid.uuid4())
        try:
            response = client.messages.create(
                model=model,
                max_tokens=4096,
                temperature=temperature,
                messages=[{"role": "user", "content": full_prompt}],
            )

            raw_code = response.content[0].text

            # Extract code from markdown fence if present
            if "```python" in raw_code:
                raw_code = raw_code.split("```python")[1].split("```")[0].strip()
            elif "```" in raw_code:
                raw_code = raw_code.split("```")[1].split("```")[0].strip()

            # Validate syntax
            parsed = None
            parse_error = None
            try:
                compile(raw_code, "<generated>", "exec")
                parsed = raw_code
            except SyntaxError as e:
                parse_error = str(e)

            samples.append(CodeSample(
                id=sample_id,
                prompt_type=prompt_type,
                generation_index=i,
                raw_code=raw_code,
                parsed_function=parsed,
                parse_error=parse_error,
                temperature=temperature,
            ))

        except Exception as e:
            samples.append(CodeSample(
                id=sample_id,
                prompt_type=prompt_type,
                generation_index=i,
                raw_code="",
                parse_error=f"API error: {str(e)}",
                temperature=temperature,
            ))

    return samples
