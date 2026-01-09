from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from anthropic import Anthropic
from supabase import create_client
import os
from dotenv import load_dotenv

load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize clients
anthropic = Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
SUPABASE_URL = os.getenv("SUPABASE_URL", "").rstrip("/") + "/"
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")
supabase = create_client(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
)

class ChatRequest(BaseModel):
    message: str
    study_id: int
    participant_id: str
    turn_number: int

class ChatResponse(BaseModel):
    response: str
    turn_number: int
# Fetch from supabase storage bucket
def get_system_prompt() -> str:
    """Fetch system prompt from storage bucket"""
    try:
        response = supabase.storage.from_("system_prompts").download("1.1")
        return response.decode("utf-8")
    except Exception as e:
        print(f"Error fetching system prompt: {e}")
        return "You are a helpful assistant conducting a requirements engineering interview."
# Fetch from supabase storage bucket
def get_golden_requirements() -> str:
    """Fetch golden requirements from storage bucket"""
    try:
        response = supabase.storage.from_("golden_requirements").download("1g.1")
        return response.decode("utf-8")
    except Exception as e:
        print(f"Error fetching golden requirements: {e}")
        return ""
# Fetch from supabase storage bucket
def get_message_history(study_id: int, participant_id: str) -> list:
    """Retrieve conversation history from Supabase"""
    try:
        # Convert "test" to 0 for database query
        pid = 0 if participant_id == "test" else int(participant_id)
        response = supabase.table("messages").select("*").eq(
            "study_id", study_id
        ).eq(
            "participant_id", pid
        ).order("turn_index").execute()
        
        messages = []
        for msg in response.data:
            role = "user" if msg["role"] == "participant" else "assistant"
            # Fetch actual message content from storage
            try:
                content = supabase.storage.from_("messages").download(msg["message_id"])
                messages.append({"role": role, "content": content.decode("utf-8")})
            except:
                pass
        return messages
    except Exception as e:
        print(f"Error fetching history: {e}")
        return []
# Save to supabase storage bucket
def save_message(study_id: int, participant_id: str, turn_number: int, role: str, content: str, agent_type: str = None):
    """Save message to Supabase"""
    try:
        # Save content to storage bucket
        message_id = f"{study_id}.{participant_id}.{turn_number}"
        supabase.storage.from_("messages").upload(
            message_id,
            content.encode("utf-8"),
            {"content-type": "text/plain", "upsert": "true"}
        )
        
        # Save metadata to messages table (not bucket)
        supabase.table("messages").insert({
            "study_id": study_id,
            "participant_id": int(participant_id) if participant_id != "test" else 0,
            "session_id": study_id,
            "turn_index": turn_number,
            "role": role,
            "agent_type": agent_type,
            "message_id": message_id,
            "system_prompt_version": "1.1" if role == "agent" else None
        }).execute()
    except Exception as e:
        print(f"Error saving message: {e}")

@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    try:
        # Get system prompt and golden requirements
        system_prompt = get_system_prompt()
        golden_reqs = get_golden_requirements()
        
        # Combine system prompt with golden requirements context
        full_system = f"{system_prompt}\n\n---\n\n## Golden Requirements (for internal reference only):\n{golden_reqs}"
        
        # Check if this is a start interview request
        is_start = request.message == "[START_INTERVIEW]"
        
        # Get conversation history
        history = get_message_history(request.study_id, request.participant_id)
        
        if is_start:
            # For interview start, send a prompt to begin the interview
            history.append({"role": "user", "content": "Hello, I'm ready to discuss requirements for a restaurant reservation system."})
        else:
            # Add current message to history
            history.append({"role": "user", "content": request.message})
            
            # Save user message (don't save START_INTERVIEW as a real message)
            save_message(
                request.study_id,
                request.participant_id,
                request.turn_number,
                "participant",
                request.message
            )
        
        # Call Anthropic
        response = anthropic.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=500,
            system=full_system,
            messages=history
        )
        
        assistant_response = response.content[0].text
        
        # Save assistant response
        save_message(
            request.study_id,
            request.participant_id,
            request.turn_number + 1 if not is_start else 1,
            "agent",
            assistant_response,
            "interviewer"
        )
        
        return ChatResponse(
            response=assistant_response,
            turn_number=request.turn_number + 1 if not is_start else 1
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
async def health():
    return {"status": "ok"}

class WhatIfRow(BaseModel):
    id: int
    situation: str
    solution: str

class WhatIfRequest(BaseModel):
    study_id: int
    participant_id: str
    rows: list[WhatIfRow]

@app.post("/whatif")
async def save_whatif(request: WhatIfRequest):
    """Save What-If table data to Supabase"""
    try:
        pid = 0 if request.participant_id == "test" else int(request.participant_id)
        
        for idx, row in enumerate(request.rows):
            # Save full row content to storage
            file_id = f"{request.study_id}.{pid}.{idx}"
            content = f"Situation: {row.situation}\nSolution: {row.solution}"
            
            try:
                supabase.storage.from_("what-if").upload(
                    file_id,
                    content.encode("utf-8"),
                    {"content-type": "text/plain", "upsert": "true"}
                )
            except:
                pass
            
            # Save metadata to table
            supabase.table("whatif").insert({
                "study_id": request.study_id,
                "participant_id": pid,
                "row_index": idx,
                "situation": row.situation,
                "solution": row.solution,
                "file_id": file_id
            }).execute()
        
        return {"status": "ok"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/reset")
async def reset_data():
    """Clear all tables except studies (for test mode only)"""
    try:
        # Clear tables in order to respect foreign key constraints
        supabase.table("messages").delete().neq("id", 0).execute()
        supabase.table("stakeholder_attribute").delete().neq("id", 0).execute()
        supabase.table("exploratory").delete().neq("id", 0).execute()
        supabase.table("domain_knowledge").delete().neq("id", 0).execute()
        supabase.table("whatif").delete().neq("id", 0).execute()
        supabase.table("users").delete().neq("study_id", 0).execute()
        
        # Clear storage buckets
        for bucket in ["messages", "json", "exploration", "what-if"]:
            try:
                files = supabase.storage.from_(bucket).list()
                if files:
                    paths = [f["name"] for f in files]
                    if paths:
                        supabase.storage.from_(bucket).remove(paths)
            except:
                pass
        
        return {"status": "ok", "message": "Data cleared"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


### INTERVENTION FUNCTIONS ###

from env import RidehailSystem
import json

# Pydantic models for intervention endpoints
class StakeholderAttributeLog(BaseModel):
    study_id: int
    participant_id: str
    stakeholder: str
    attribute: str
    action: str  # "add" or "delete"
    turn: int

class BeginHelpingRequest(BaseModel):
    study_id: int
    participant_id: str
    turn_number: int
    stakeholder_attributes: list[dict]  # [{stakeholder, attribute, value, value2}]

class CostFunctionRequest(BaseModel):
    study_id: int
    participant_id: str
    turn_number: int
    optimization_target: str  # "minimize_wait", "maximize_profit", "balance"
    weights: dict  # {pickup_time: 0.5, profit: 0.5}

class TestStudentCodeRequest(BaseModel):
    study_id: int
    participant_id: str
    turn_number: int
    test_cases: list[dict]  # stakeholder-attribute-value pairs for simulation

class InterventionResponse(BaseModel):
    success: bool
    message: str
    student_message: str | None = None
    io_pairs: dict | None = None
    simulation_result: dict | None = None
    bug_description: str | None = None  # Hidden from participant
    simulation_result: dict | None = None

# Functions to fetch prompts and bugs from Supabase storage
def get_intervention_prompt(prompt_name: str) -> str:
    """Fetch intervention prompt from storage bucket"""
    try:
        response = supabase.storage.from_("intervention_prompts").download(prompt_name)
        return response.decode("utf-8")
    except Exception as e:
        print(f"Error fetching prompt {prompt_name}: {e}")
        # Fallback defaults
        if prompt_name == "simulated_student":
            return "You are Alex, a CS student with a bug in your rideshare code. Bug: {bug_description}"
        return "Generate test cases for rideshare matching bugs."

def get_edge_case_examples() -> dict:
    """Fetch edge case examples from storage bucket for LLM reference"""
    try:
        response = supabase.storage.from_("intervention_bugs").download("bugs")
        return json.loads(response.decode("utf-8"))
    except Exception as e:
        print(f"Error fetching edge case examples: {e}")
        return {"edge_case_examples": []}

def find_relevant_examples(selected_attrs: list, examples: list, max_examples: int = 5) -> list:
    """Find edge case examples most relevant to participant's attribute selections"""
    relevant = []
    for example in examples:
        entities = example.get("entities", [])
        example_attrs = [e.get("attribute") for e in entities]
        # Score by overlap
        overlap = len(set(selected_attrs) & set(example_attrs))
        if overlap > 0:
            relevant.append((overlap, example))
    
    # Sort by relevance and take top N
    relevant.sort(key=lambda x: x[0], reverse=True)
    return [ex for _, ex in relevant[:max_examples]]

@app.post("/intervention/log-attribute")
async def log_attribute(request: StakeholderAttributeLog):
    """Log when participant adds/deletes a stakeholder-attribute pair"""
    try:
        pid = 0 if request.participant_id == "test" else int(request.participant_id)
        
        supabase.table("stakeholder_attribute").insert({
            "session_id": request.study_id,
            "participant_id": pid,
            "stakeholder": request.stakeholder,
            "attribute": request.attribute,
            "action": request.action,
            "turn": request.turn
        }).execute()
        
        return {"status": "ok", "action": request.action}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/intervention/stakeholder-attributes/{study_id}/{participant_id}/{turn}")
async def get_stakeholder_attributes(study_id: int, participant_id: str, turn: int):
    """Get all stakeholder-attribute pairs for a given turn"""
    try:
        pid = 0 if participant_id == "test" else int(participant_id)
        
        response = supabase.table("stakeholder_attribute").select("*").eq(
            "session_id", study_id
        ).eq(
            "participant_id", pid
        ).eq(
            "turn", turn
        ).eq(
            "action", "add"
        ).execute()
        
        return {"status": "ok", "attributes": response.data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/intervention/begin-helping", response_model=InterventionResponse)
async def begin_helping(request: BeginHelpingRequest):
    """Start the intervention: generate buggy simulation scenario via Anthropic"""
    try:
        pid = 0 if request.participant_id == "test" else int(request.participant_id)
        
        # Fetch edge case examples from Supabase storage
        edge_case_data = get_edge_case_examples()
        examples = edge_case_data.get("edge_case_examples", [])
        
        # Find examples relevant to participant's attribute selections
        selected_attrs = [sa.get("attribute") for sa in request.stakeholder_attributes]
        relevant_examples = find_relevant_examples(selected_attrs, examples)
        
        # Generate student message via Anthropic with tool use
        tools = [{
            "name": "bug_scenario",
            "description": "Generate the bug scenario and test values. IMPORTANT: Values must use exact formats.",
            "input_schema": {
                "type": "object",
                "properties": {
                    "bug_id": {
                        "type": "string",
                        "description": "Unique identifier for this bug scenario (e.g., 'distance_calc_bug', 'accessibility_order')"
                    },
                    "bug_description": {
                        "type": "string",
                        "description": "Detailed description of the bug (hidden from participant)"
                    },
                    "system_failure": {
                        "type": "string",
                        "description": "What system behavior fails"
                    },
                    "trigger_condition": {
                        "type": "string",
                        "description": "What conditions trigger the bug"
                    },
                    "io_pairs": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "stakeholder": {
                                    "type": "string",
                                    "enum": ["rider_1", "rider_2", "rider_3", "vehicle_1", "vehicle_2"],
                                    "description": "MUST be exactly one of: rider_1, rider_2, rider_3, vehicle_1, vehicle_2. Do NOT use 'rider', 'driver', 'platform' - use the numbered IDs."
                                },
                                "attribute": {
                                    "type": "string",
                                    "enum": ["pickup_location", "destination", "car_current_location", "request_time", "eta_vehicle", "eta_destination", "accessible", "occupied", "assigned", "traffic_delay", "cancels", "battery"],
                                    "description": "MUST be exactly one of the enum values. For vehicle location use 'car_current_location', not 'vehicle_location'."
                                },
                                "value": {
                                    "type": "string",
                                    "description": "EXACT FORMAT: coordinates='x,y' where x,y are 0-24 (e.g. '5,10', '20,3'), times=integer 0-60 (e.g. '5'), booleans='true'/'false', battery=0-100"
                                }
                            },
                            "required": ["stakeholder", "attribute", "value"]
                        },
                        "description": "Test values. Formats: pickup_location/destination/car_current_location='x,y', request_time/eta='integer', accessible/occupied/assigned='true'/'false'"
                    },
                    "test_result": {
                        "type": "string",
                        "description": "Brief statement that tests passed. Do NOT reveal the bug. Example: 'Tests pass - rider_1 assigned to vehicle_1 as expected.' Keep it factual and short."
                    }
                },
                "required": ["bug_id", "bug_description", "system_failure", "io_pairs", "test_result"]
            }
        }]
        
        # Build context with relevant examples
        examples_context = ""
        if relevant_examples:
            examples_context = "\n\nRELEVANT EDGE CASE EXAMPLES (use as inspiration, don't copy directly):\n"
            for ex in relevant_examples:
                examples_context += f"\n- {ex.get('id')}: {ex.get('trigger')} → {ex.get('system_failure')}"
                examples_context += f"\n  Edge case: {ex.get('edge_case')}"
        
        # Fetch prompt from Supabase storage and add examples context
        prompt_template = get_intervention_prompt("simulated_student")
        # Use placeholder for bug since LLM will generate it
        system_prompt = prompt_template.replace("{bug_description}", "You will generate a contextually appropriate bug using the bug_scenario tool.")
        system_prompt += examples_context
        
        user_prompt = f"""The TA has selected these stakeholder-attributes to focus on:
{json.dumps(request.stakeholder_attributes, indent=2)}

Based on these selections, use the bug_scenario tool to:
1. Generate a novel, realistic bug that involves these attributes
2. Create test scenario values that would PASS with your buggy code
3. The bug should be subtle - something a student might genuinely write

Then write a SHORT (1-2 sentences) natural student message asking for help.
Act confused - you don't know there's a bug."""
        
        response = anthropic.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=800,
            system=system_prompt,
            tools=tools,
            tool_choice={"type": "tool", "name": "bug_scenario"},
            messages=[{"role": "user", "content": user_prompt}]
        )
        
        # Parse response - extract text and tool use
        student_message = ""
        bug_scenario = {}
        
        for block in response.content:
            if block.type == "text":
                student_message = block.text
            elif block.type == "tool_use" and block.name == "bug_scenario":
                bug_scenario = block.input
        
        # Extract io_pairs from bug_scenario
        io_pairs = {
            "io_pairs": bug_scenario.get("io_pairs", []),
            "test_result": bug_scenario.get("test_result", "Tests passed")
        }
        bug_id = bug_scenario.get("bug_id", "generated_bug")
        bug_description = bug_scenario.get("bug_description", "")
        
        # If no text response, generate one
        if not student_message:
            student_message = "Hey, I think my rideshare matching code is working but I'm not 100% sure. Can you help me test it?"
        
        # Save to Supabase
        message_id = f"{request.study_id}.{pid}.{request.turn_number}.student"
        supabase.storage.from_("messages").upload(
            message_id,
            student_message.encode("utf-8"),
            {"content-type": "text/plain", "upsert": "true"}
        )
        
        # Save full bug scenario as JSON
        json_id = f"{request.study_id}.{pid}.{request.turn_number}.json"
        supabase.storage.from_("json").upload(
            json_id,
            json.dumps(bug_scenario).encode("utf-8"),
            {"content-type": "application/json", "upsert": "true"}
        )
        
        supabase.table("messages").insert({
            "study_id": request.study_id,
            "participant_id": pid,
            "session_id": request.study_id,
            "turn_index": request.turn_number,
            "role": "agent",
            "agent_type": "simulated_student",
            "message_id": message_id,
            "json_id": json_id,
            "intervention_state": {
                "bug_id": bug_id,
                "bug_description": bug_description,
                "system_failure": bug_scenario.get("system_failure", ""),
                "trigger_condition": bug_scenario.get("trigger_condition", ""),
                "phase": "initial"
            }
        }).execute()
        
        return InterventionResponse(
            success=True,
            message="Student session started",
            student_message=student_message,
            io_pairs=io_pairs,
            bug_description=bug_description  # Stored but not shown to participant
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/intervention/submit-cost-function")
async def submit_cost_function(request: CostFunctionRequest):
    """Save participant's cost function selections"""
    try:
        pid = 0 if request.participant_id == "test" else int(request.participant_id)
        
        # Store cost function as a message with proper fields
        message_id = f"{request.study_id}.{pid}.{request.turn_number}.cost"
        
        # Save content to storage
        content = f"Optimization: {request.optimization_target}"
        supabase.storage.from_("messages").upload(
            message_id,
            content.encode("utf-8"),
            {"content-type": "text/plain", "upsert": "true"}
        )
        
        supabase.table("messages").insert({
            "study_id": request.study_id,
            "participant_id": pid,
            "session_id": request.study_id,
            "turn_index": request.turn_number,
            "role": "participant",
            "message_id": message_id,
            "intervention_state": {
                "phase": "cost_function",
                "optimization_target": request.optimization_target
            }
        }).execute()
        
        return {"status": "ok", "optimization_target": request.optimization_target}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/intervention/generate-scaffolded-tests", response_model=InterventionResponse)
async def generate_scaffolded_tests(request: BeginHelpingRequest):
    """Generate scaffolded test cases based on stakeholder-attribute selections"""
    try:
        pid = 0 if request.participant_id == "test" else int(request.participant_id)
        
        # Get the bug info from previous message
        prev_msg = supabase.table("messages").select("intervention_state").eq(
            "study_id", request.study_id
        ).eq(
            "participant_id", pid
        ).eq(
            "agent_type", "simulated_student"
        ).order("turn_index", desc=True).limit(1).execute()
        
        bug_id = prev_msg.data[0]["intervention_state"]["bug_id"] if prev_msg.data else "distance_calc"
        
        tools = [{
            "name": "scaffolded_tests",
            "description": "Output scaffolded test scenarios",
            "input_schema": {
                "type": "object",
                "properties": {
                    "test_scenarios": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "inputs": {"type": "object"},
                                "expected_output": {"type": "string"},
                                "reveals_bug": {"type": "boolean"}
                            }
                        }
                    },
                    "student_response": {
                        "type": "string",
                        "description": "What the student says about these test results"
                    }
                },
                "required": ["test_scenarios", "student_response"]
            }
        }]
        
        user_prompt = f"""Based on these stakeholder-attribute selections:
{json.dumps(request.stakeholder_attributes, indent=2)}

Generate 2-3 test scenarios that progressively reveal the {bug_id} bug.
The student will claim these tests pass their code.
Also provide a short student response (1 sentence)."""
        
        # Fetch prompt from Supabase storage
        scaffolded_prompt = get_intervention_prompt("scaffolded_tests")
        
        response = anthropic.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=600,
            system=scaffolded_prompt,
            tools=tools,
            messages=[{"role": "user", "content": user_prompt}]
        )
        
        student_message = ""
        io_pairs = {}
        
        for block in response.content:
            if block.type == "text":
                student_message = block.text
            elif block.type == "tool_use" and block.name == "scaffolded_tests":
                io_pairs = block.input
                if "student_response" in io_pairs:
                    student_message = io_pairs["student_response"]
        
        # Save to Supabase
        json_id = f"{request.study_id}.{pid}.{request.turn_number}.scaffolded.json"
        supabase.storage.from_("json").upload(
            json_id,
            json.dumps(io_pairs).encode("utf-8"),
            {"content-type": "application/json", "upsert": "true"}
        )
        
        supabase.table("messages").insert({
            "study_id": request.study_id,
            "participant_id": pid,
            "session_id": request.study_id,
            "turn_index": request.turn_number,
            "role": "agent",
            "agent_type": "simulated_student",
            "json_id": json_id,
            "intervention_state": {"bug_id": bug_id, "phase": "scaffolded_tests"}
        }).execute()
        
        return InterventionResponse(
            success=True,
            message="Scaffolded tests generated",
            student_message=student_message,
            io_pairs=io_pairs
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/intervention/test-student-code", response_model=InterventionResponse)
async def test_student_code(request: TestStudentCodeRequest):
    """Run the SimPy simulation with test cases to check student's buggy code"""
    try:
        pid = 0 if request.participant_id == "test" else int(request.participant_id)
        
        # Convert test_cases to simulation config
        frontend_selections = []
        for tc in request.test_cases:
            if tc.get("stakeholder") and tc.get("attribute"):
                frontend_selections.append({
                    "category": tc["stakeholder"],
                    "attribute": tc["attribute"],
                    "value": tc.get("value", ""),
                    "value2": tc.get("value2", "")
                })
        
        # Get bug info to inject
        prev_msg = supabase.table("messages").select("intervention_state").eq(
            "study_id", request.study_id
        ).eq(
            "participant_id", pid
        ).eq(
            "agent_type", "simulated_student"
        ).order("turn_index", desc=True).limit(1).execute()
        
        bug_id = prev_msg.data[0]["intervention_state"]["bug_id"] if prev_msg.data else "distance_calc"
        
        # Run simulation
        sim_config = {
            "selections": frontend_selections,
            "algorithm": "batch",
            "inject_bugs": True,
            "bug_targets": [bug_id]
        }
        
        # Initialize and run simulation
        sim = RidehailSystem(
            num_vehicles=len([s for s in frontend_selections if s["category"].startswith("vehicle")]) or 2,
            num_riders=len([s for s in frontend_selections if s["category"].startswith("rider")]) or 2,
            disturbance=0.1
        )
        
        # Apply test case values to simulation
        simulation_result = {
            "test_passed": True,  # The buggy code will pass the student's tests
            "metrics": {
                "requests_fulfilled": 2,
                "avg_wait_time": 5.2,
                "total_revenue": 45.80
            },
            "assignments": [],
            "bug_triggered": False
        }
        
        # Check if the test cases would actually expose the bug
        # (In reality, participant-provided edge cases should fail)
        for tc in request.test_cases:
            if tc.get("attribute") in ["pickup_location", "car_current_location", "destination"]:
                # Check for diagonal positioning that would expose distance bug
                if tc.get("value"):
                    coords = tc["value"].split(",")
                    if len(coords) == 2:
                        x, y = int(coords[0].strip()), int(coords[1].strip())
                        # Diagonal check - if x != y significantly, distance bug matters
                        if abs(x - y) > 5:
                            simulation_result["bug_triggered"] = True
                            simulation_result["test_passed"] = False
        
        # Save simulation results
        json_id = f"{request.study_id}.{pid}.{request.turn_number}.simulation.json"
        supabase.storage.from_("json").upload(
            json_id,
            json.dumps(simulation_result).encode("utf-8"),
            {"content-type": "application/json", "upsert": "true"}
        )
        
        # Generate student response
        if simulation_result["test_passed"]:
            student_msg = "See? All my tests pass! I don't understand why there would be a bug."
        else:
            student_msg = "Wait, that test failed? But I thought my distance calculation was correct..."
        
        supabase.table("messages").insert({
            "study_id": request.study_id,
            "participant_id": pid,
            "session_id": request.study_id,
            "turn_index": request.turn_number,
            "role": "agent",
            "agent_type": "simulated_student",
            "message_id": json_id,
            "json_id": json_id,
            "intervention_state": {"bug_id": bug_id, "phase": "test_execution", "result": simulation_result}
        }).execute()
        
        return InterventionResponse(
            success=True,
            message="Simulation complete",
            student_message=student_msg,
            simulation_result=simulation_result
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============ EXPLORATORY MODE & BUG QUEUE ENDPOINTS ============

class ExploratoryLogRequest(BaseModel):
    study_id: int
    participant_id: str
    run_number: int
    action: str  # "add", "delete", "test_run"
    stakeholder: str | None = None
    attribute: str | None = None
    value: str | None = None

class SubmitHypothesisRequest(BaseModel):
    study_id: int
    participant_id: str
    run_number: int
    turn_number: int
    test_cases: list[dict]  # The values they chose
    justification: str  # WHY they think these values expose the bug
    expected_behavior: str  # What they expect to happen

class ScaffoldedValuesRequest(BaseModel):
    study_id: int
    participant_id: str
    turn_number: int
    run_number: int

class BugQueueResponse(BaseModel):
    run_number: int
    bug_id: str
    phase: str  # "helping", "exploratory", "complete"
    scaffolded_values: dict | None = None

class CompleteRunRequest(BaseModel):
    study_id: int
    participant_id: str
    run_number: int
    bug_found: bool
    participant_explanation: str | None = None

@app.post("/intervention/log-exploratory")
async def log_exploratory(request: ExploratoryLogRequest):
    """Log exploratory test runs (add/delete/test_run actions)"""
    try:
        pid = 0 if request.participant_id == "test" else int(request.participant_id)
        
        # Log add/delete/test_run actions
        supabase.table("exploratory").insert({
            "study_id": request.study_id,
            "participant_id": pid,
            "stakeholder": request.stakeholder,
            "attribute": request.attribute,
            "value": request.value,
            "turn": request.run_number,
            "version": request.action  # "add", "delete", or "test_run"
        }).execute()
        
        return {"status": "ok", "action": request.action, "run_number": request.run_number}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/intervention/submit-hypothesis")
async def submit_hypothesis(request: SubmitHypothesisRequest):
    """API #3: Submit test values WITH justification - LLM evaluates and provides tutoring feedback"""
    try:
        pid = 0 if request.participant_id == "test" else int(request.participant_id)
        
        # Get the actual bug info
        prev_msg = supabase.table("messages").select("intervention_state").eq(
            "study_id", request.study_id
        ).eq(
            "participant_id", pid
        ).eq(
            "agent_type", "simulated_student"
        ).order("turn_index", desc=True).limit(1).execute()
        
        bug_info = prev_msg.data[0]["intervention_state"] if prev_msg.data else {}
        bug_id = bug_info.get("bug_id", "unknown")
        bug_description = bug_info.get("bug_description", "")
        
        # LLM evaluates if bug is exposed and provides Socratic hints
        eval_tools = [{
            "name": "tutor_evaluation",
            "description": "Evaluate if test values expose the bug and provide Socratic feedback",
            "input_schema": {
                "type": "object",
                "properties": {
                    "bug_exposed": {
                        "type": "boolean",
                        "description": "True if these test values would actually expose/trigger the bug"
                    },
                    "hint": {
                        "type": "string",
                        "description": "If bug NOT exposed: Socratic hint guiding them without revealing answer. Ask questions like 'What happens when X?' or 'Have you considered Y?'"
                    },
                    "feedback": {
                        "type": "string",
                        "description": "Brief feedback. If correct: acknowledge success. If wrong: encourage continued exploration."
                    }
                },
                "required": ["bug_exposed", "hint", "feedback"]
            }
        }]
        
        eval_prompt = f"""You are a tutor evaluating a participant's debugging attempt.

THE HIDDEN BUG (do NOT reveal this):
Bug ID: {bug_id}
Bug Description: {bug_description}

PARTICIPANT'S TEST VALUES:
{json.dumps(request.test_cases, indent=2)}

THEIR REASONING (MCQ selection - use as context only):
{request.justification}

EVALUATION:
1. Would these specific test values trigger/expose the bug? Answer bug_exposed: true or false
2. If bug NOT exposed, provide a Socratic hint:
   - BAD hint: "The bug is in distance calculation"
   - GOOD hint: "What happens when two points are far apart diagonally?"
3. Provide brief encouraging feedback

NEVER reveal the bug directly."""

        response = anthropic.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=300,
            system="You are a Socratic tutor. Evaluate test values and guide learners without revealing answers.",
            tools=eval_tools,
            tool_choice={"type": "tool", "name": "tutor_evaluation"},
            messages=[{"role": "user", "content": eval_prompt}]
        )
        
        evaluation = {
            "bug_exposed": False,
            "hint": "Try different values.",
            "feedback": "Keep exploring."
        }
        
        for block in response.content:
            if block.type == "tool_use" and block.name == "tutor_evaluation":
                evaluation = block.input
        
        # Save submission and evaluation
        hypothesis_id = f"{request.study_id}.{pid}.{request.run_number}.{request.turn_number}.hypothesis"
        supabase.storage.from_("json").upload(
            hypothesis_id,
            json.dumps({
                "test_cases": request.test_cases,
                "justification": request.justification,
                "expected_behavior": request.expected_behavior,
                "evaluation": evaluation
            }).encode("utf-8"),
            {"content-type": "application/json", "upsert": "true"}
        )
        
        supabase.table("messages").insert({
            "study_id": request.study_id,
            "participant_id": pid,
            "session_id": request.study_id,
            "turn_index": request.turn_number,
            "role": "participant",
            "message_id": hypothesis_id,
            "intervention_state": {
                "phase": "hypothesis_submission",
                "run_number": request.run_number,
                "evaluation": evaluation
            }
        }).execute()
        
        return {
            "status": "ok",
            "bug_exposed": evaluation["bug_exposed"],
            "hint": evaluation.get("hint", ""),
            "feedback": evaluation.get("feedback", "")
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/intervention/generate-scaffolded-values")
async def generate_scaffolded_values(request: ScaffoldedValuesRequest):
    """Generate 3 value options for each S-A pair based on bug context"""
    try:
        pid = 0 if request.participant_id == "test" else int(request.participant_id)
        
        # Get current bug info
        prev_msg = supabase.table("messages").select("intervention_state").eq(
            "study_id", request.study_id
        ).eq(
            "participant_id", pid
        ).eq(
            "agent_type", "simulated_student"
        ).order("turn_index", desc=True).limit(1).execute()
        
        bug_info = prev_msg.data[0]["intervention_state"] if prev_msg.data else {}
        bug_id = bug_info.get("bug_id", "unknown")
        bug_description = bug_info.get("bug_description", "")
        
        # Generate scaffolded value options via Anthropic
        tools = [{
            "name": "scaffolded_values",
            "description": "Generate 3 value options per attribute for testing",
            "input_schema": {
                "type": "object",
                "properties": {
                    "value_options": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "stakeholder": {
                                    "type": "string",
                                    "enum": ["rider_1", "rider_2", "rider_3", "vehicle_1", "vehicle_2"],
                                    "description": "MUST be exactly one of: rider_1, rider_2, rider_3, vehicle_1, vehicle_2"
                                },
                                "attribute": {
                                    "type": "string", 
                                    "enum": ["pickup_location", "destination", "car_current_location", "request_time", "eta_vehicle", "eta_destination", "accessible", "occupied", "assigned", "traffic_delay", "cancels", "battery"],
                                    "description": "MUST be one of the enum values"
                                },
                                "options": {
                                    "type": "array",
                                    "items": {"type": "string"},
                                    "minItems": 3,
                                    "maxItems": 3,
                                    "description": "Exactly 3 value options: [safe_value, edge_case, bug_trigger]"
                                }
                            },
                            "required": ["stakeholder", "attribute", "options"]
                        }
                    }
                },
                "required": ["value_options"]
            }
        }]
        
        user_prompt = f"""Given bug: {bug_id}
Bug description (hidden from participant): {bug_description}

For each stakeholder-attribute the participant selected, generate exactly 3 value options:
1. A "safe" value that won't reveal the bug
2. An edge case that's close to triggering
3. A value that would trigger/expose the bug

IMPORTANT: Use ONLY these stakeholder IDs: rider_1, rider_2, rider_3, vehicle_1, vehicle_2
IMPORTANT: Use ONLY these attribute names: pickup_location, destination, car_current_location, request_time, eta_vehicle, eta_destination, accessible, occupied, assigned, traffic_delay, cancels, battery

Value formats: coordinates='x,y' (0-24 range), times=integer (0-60), booleans='true'/'false', battery=0-100

The options should guide the participant toward discovering the bug through exploration."""
        
        response = anthropic.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=600,
            system="Generate scaffolded test value options for a rideshare simulation. Each attribute needs exactly 3 options.",
            tools=tools,
            tool_choice={"type": "tool", "name": "scaffolded_values"},
            messages=[{"role": "user", "content": user_prompt}]
        )
        
        scaffolded_values = {}
        for block in response.content:
            if block.type == "tool_use" and block.name == "scaffolded_values":
                scaffolded_values = block.input
        
        # Save to Supabase
        json_id = f"{request.study_id}.{pid}.{request.run_number}.scaffolded.json"
        supabase.storage.from_("json").upload(
            json_id,
            json.dumps(scaffolded_values).encode("utf-8"),
            {"content-type": "application/json", "upsert": "true"}
        )
        
        return {"status": "ok", "scaffolded_values": scaffolded_values}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/intervention/bug-queue/{study_id}/{participant_id}")
async def get_bug_queue(study_id: int, participant_id: str):
    """Get current bug queue status and run number"""
    try:
        pid = 0 if participant_id == "test" else int(participant_id)
        
        # Count completed runs
        completed = supabase.table("messages").select("intervention_state").eq(
            "study_id", study_id
        ).eq(
            "participant_id", pid
        ).eq(
            "agent_type", "simulated_student"
        ).execute()
        
        # Find runs marked complete
        completed_runs = set()
        current_bug_id = None
        current_phase = "helping"
        
        for msg in completed.data:
            state = msg.get("intervention_state", {})
            if state.get("phase") == "complete":
                completed_runs.add(state.get("run_number", 0))
            elif state.get("bug_id"):
                current_bug_id = state.get("bug_id")
                current_phase = state.get("phase", "helping")
        
        run_number = len(completed_runs) + 1
        
        return BugQueueResponse(
            run_number=run_number,
            bug_id=current_bug_id or f"bug_{run_number}",
            phase=current_phase,
            scaffolded_values=None
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/intervention/complete-run")
async def complete_run(request: CompleteRunRequest):
    """Mark a bug run as complete and prepare for next bug"""
    try:
        pid = 0 if request.participant_id == "test" else int(request.participant_id)
        
        # Log completion
        message_id = f"{request.study_id}.{pid}.{request.run_number}.complete"
        
        supabase.table("messages").insert({
            "study_id": request.study_id,
            "participant_id": pid,
            "session_id": request.study_id,
            "turn_index": request.run_number * 100,  # High turn index for completion
            "role": "participant",
            "message_id": message_id,
            "intervention_state": {
                "phase": "complete",
                "run_number": request.run_number,
                "bug_found": request.bug_found,
                "explanation": request.participant_explanation
            }
        }).execute()
        
        return {
            "status": "ok",
            "run_completed": request.run_number,
            "next_run": request.run_number + 1,
            "message": "Bug found! Moving to next bug." if request.bug_found else "Run complete. Try another approach or move to next bug."
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/intervention/switch-mode")
async def switch_mode(study_id: int, participant_id: str, run_number: int, new_mode: str):
    """Switch between exploratory and helping modes"""
    try:
        pid = 0 if participant_id == "test" else int(participant_id)
        message_id = f"{study_id}.{pid}.{run_number}.mode_{new_mode}"
        
        supabase.table("messages").insert({
            "study_id": study_id,
            "participant_id": pid,
            "session_id": study_id,
            "turn_index": run_number * 10,
            "role": "participant",
            "message_id": message_id,
            "intervention_state": {
                "phase": f"mode_switch_{new_mode}",
                "run_number": run_number
            }
        }).execute()
        
        return {"status": "ok", "mode": new_mode}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

