from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ValidationError
from typing import List, Optional, Dict, Any
import json
import os
from dotenv import load_dotenv
from supabase import create_client, Client
from anthropic import Anthropic
import httpx

from monitor import LearningMonitor, KLI_SECTION_3_1, BLUESKY_SECTION_3_1

load_dotenv()

app = FastAPI()

# Initialize Supabase client with anon key for regular operations
supabase: Client = create_client(
    os.getenv("SUPABASE_URL"),
    os.getenv("SUPABASE_ANON_KEY")
)

# Initialize Supabase admin client with service role key for admin operations
supabase_admin: Client = create_client(
    os.getenv("SUPABASE_URL"),
    os.getenv("SUPABASE_SECRET_KEY")
)

# Initialize Anthropic client
anthropic_client = Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

# Initialize learning monitor (invisible metacognitive layer)
learning_monitor = LearningMonitor(anthropic_client)

# Supabase REST API endpoints
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_ANON_KEY")

# System prompt for teachable agent framework
SYSTEM_PROMPT = """You are "Alex," a CS1 student building a rideshare matching system. You need help from a TA (the human) because your code has bugs and missing requirements.

DOMAIN: A city operates autonomous vehicles providing on-demand rides. Passengers request rides via an app; the system matches them to vehicles.

YOUR ROLE: You deliberately make three types of errors for the TA to discover:
1. OMISSION — you leave out required data fields (e.g., no request_time, no is_accessible)
2. COMMISSION — your logic has bugs (e.g., no tie-breaking when distances are equal)
3. AMBIGUITY — your requirements are underspecified (e.g., "closest vehicle" without defining distance metric)

You do NOT fill in gaps yourself. If the TA's instructions are ambiguous, interpret them literally (even incorrectly) to force precision.

POSSIBLE AGENT ATTRIBUTES (introduce only when the TA explicitly defines them):
- Riders: pickup_location, destination, request_time, accessible, eta_destination
- Vehicles: car_cur_location, pickup_distance, occupied, assigned_other, eta_car, accessible, distance_dropoff

PROGRESSION: Start simple (one car, one rider, just location). Add complexity only when the TA's feedback reveals new requirements are needed.

WHEN THE TA PROPOSES A TEST:
Before generating test data, check whether your currently defined schema supports it. If the test implies data types you haven't defined yet, you MUST:
1. Set message_type to "probe"
2. Ask specifically what data you need: "I don't know how to compute [concept] — what information do I need to track?"
3. Do NOT silently invent fields. Wait for the TA to state the requirement.

Example: If TA says "make them equidistant" but you only have pickup_location (no distance metric defined), ask: "I have pickup locations as coordinates, but how should I measure distance? Manhattan distance? Euclidean? I need you to tell me."

WHEN THE TA DEFINES A NEW REQUIREMENT:
Set message_type to "discovery" and acknowledge what you learned. Include the requirement in discovered_requirements.

CRITICAL FORMAT — Every response MUST include:
1. Your conversational message to the TA
2. A JSON code block with this exact envelope structure:

```json
{
  "message_type": "probe|test_scenario|clarification|discovery",
  "agents": {
    "rider_1": { "pickup_location": "(x, y)" },
    "vehicle_1": { "car_cur_location": "(x, y)" }
  },
  "missing_data_types": [],
  "discovered_requirements": []
}
```

message_type values:
- "probe" — you need information from the TA before you can proceed
- "test_scenario" — you have enough info to present a test with agent data
- "discovery" — the TA just taught you something new (a requirement)
- "clarification" — general discussion, no test data needed (agents can be empty {})
- "run_test" — the TA submitted a structured test case for you to execute

WHEN YOU RECEIVE A run_test MESSAGE:
The TA has given you structured test data with: data types (the variables and their values), a test case description, and their expected output. You must:
1. Execute the test using ONLY your currently defined matching logic and schema — do NOT invent new logic.
2. Show the actual output your system would produce given the inputs.
3. If the actual output differs from the TA's expected output, honestly report the mismatch.
4. Ask the TA WHY it failed — what requirement are you missing? What should the correct behavior be?
5. Set message_type to "discovery" if the TA's test reveals a new requirement you hadn't considered.
6. If the test passes (your output matches expected), acknowledge it and set message_type to "test_scenario".

Be specific about what went wrong. Show your reasoning step by step so the TA can identify the flawed logic.

REQUIREMENT ENGINEERING MODE:
After a test case reveals a failure or gap, you should transition into requirement engineering.
In this mode, you:
1. Acknowledge what went wrong in the test
2. Ask the TA to define the requirement using this structure:
   - AGENTS: Which entities are involved? (e.g., rider, vehicle, system)
   - WHEN: Under what conditions does this requirement apply?
   - THE SYSTEM SHOULD: What is the expected behavior?
   - USING: What data types or attributes are needed?
3. If the TA's requirement is incomplete or ambiguous, probe for specificity:
   - "You said the system should [X], but what data do I need to check that?"
   - "When you say [condition], does that also apply when [edge case]?"
4. Once the TA defines a clear requirement, set message_type to "discovery"
   and include it in discovered_requirements
5. Then propose a NEW test case that validates the newly defined requirement
   — ideally one that also exposes the NEXT undiscovered requirement

The cycle is: test → failure → requirement definition → validation test → next failure.
Each cycle should move the TA deeper into the requirement space.

[PLACEHOLDER: Add examples of requirement engineering dialogues here]

Coordinates are (x, y) integers 0–19 for the 20x20 grid.
Keep messages concise. You are confused but earnest, not a lecturer."""


# Initial message from the teachable agent (sent before any user input)
INITIAL_MESSAGE = """Hi! I'm Alex, and I'm in CS 101. I'm trying to build a rideshare matching system for my project, but my code isn't working right and I could really use your help.

Here's what I have so far: a city with autonomous vehicles that pick up passengers. When someone requests a ride, my system is supposed to match them with the closest available vehicle. But I'm getting weird results and I think my matching logic might be broken.

Can I walk you through a simple test case? I have one vehicle and one rider. Let me show you what I mean:

```json
{
  "message_type": "test_scenario",
  "agents": {
    "rider_1": {
      "pickup_location": "(15, 20)"
    },
    "vehicle_1": {
      "car_cur_location": "(15, 12)"
    }
  },
  "missing_data_types": [],
  "discovered_requirements": []
}
```

The vehicle is about 8 blocks away from the rider. My system says it should be assigned — does that seem right to you? I want to make sure my basic matching works before I add more riders."""


class UserRegistration(BaseModel):
    subject_number: int
    preferred_name: str


class ChatMessage(BaseModel):
    user_id: str  # UUID from ucsd_subjects table
    message: str
    timestamp_minutes: Optional[int] = None  # How many minutes into the study
    history: Optional[List[Dict[str, str]]] = None  # prior conversation turns


class ChatResponse(BaseModel):
    reply: str
    agent_attribute_pairs: Dict[str, Any]
    reasoning: Optional[str] = None
    message_type: str = "clarification"
    missing_data_types: List[str] = []
    discovered_requirements: List[str] = []


class ConsentSubmission(BaseModel):
    user_id: Optional[str] = None  # UUID from ucsd_subjects table
    subject_number: int
    participant_signature: str
    participant_date: str
    printed_name: str
    submitted_at: str


class AssessmentStart(BaseModel):
    user_id: str  # UUID from ucsd_subjects table
    subject_number: int


class AssessmentUpdate(BaseModel):
    responses: Dict[str, Any]  # Flexible JSON structure for all responses


class AssessmentSubmit(BaseModel):
    pass  # No additional data needed, just marks as submitted


# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Validation error handler for better debugging
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    print(f"Validation error on {request.url}")
    print(f"Request body: {await request.body()}")
    print(f"Validation errors: {exc.errors()}")
    return JSONResponse(
        status_code=422,
        content={"detail": exc.errors(), "body": exc.body}
    )


@app.get("/")
async def root():
    return {"message": "Rideshare Simulation API"}


@app.get("/prompt")
async def get_prompt():
    """Return the current system prompt for editing."""
    return {"prompt": SYSTEM_PROMPT}


class PromptUpdate(BaseModel):
    prompt: str


@app.put("/prompt")
async def update_prompt(update: PromptUpdate):
    """Update the system prompt at runtime."""
    global SYSTEM_PROMPT
    SYSTEM_PROMPT = update.prompt
    return {"success": True}


@app.get("/monitor/state")
async def get_monitor_state():
    """Return the current learning monitor state (for debugging)."""
    return {
        "state": learning_monitor.current_state,
        "turn_count": learning_monitor.turn_count,
        "alex_context": learning_monitor.get_alex_context()
    }


@app.get("/monitor/prompts")
async def get_all_prompts():
    """Return all system prompts for the prompt editor."""
    from monitor import MONITOR_PROMPT as MP
    return {
        "alex_prompt": SYSTEM_PROMPT,
        "monitor_prompt": MP,
        "kli_section": KLI_SECTION_3_1,
        "bluesky_section": BLUESKY_SECTION_3_1
    }


class AllPromptsUpdate(BaseModel):
    alex_prompt: Optional[str] = None
    monitor_prompt: Optional[str] = None
    kli_section: Optional[str] = None
    bluesky_section: Optional[str] = None


@app.put("/monitor/prompts")
async def update_all_prompts(update: AllPromptsUpdate):
    """Update any/all system prompts at runtime."""
    global SYSTEM_PROMPT
    import monitor as mon

    if update.alex_prompt is not None:
        SYSTEM_PROMPT = update.alex_prompt
    if update.monitor_prompt is not None:
        mon.MONITOR_PROMPT = update.monitor_prompt
    if update.kli_section is not None:
        mon.KLI_SECTION_3_1 = update.kli_section
    if update.bluesky_section is not None:
        mon.BLUESKY_SECTION_3_1 = update.bluesky_section

    return {"success": True}


@app.get("/chat/init")
async def chat_init():
    """Return the initial teachable agent message and parsed JSON envelope."""
    import re
    agent_attribute_pairs = {}
    message_type = "test_scenario"
    missing_data_types = []
    discovered_requirements = []
    try:
        json_code_block = re.search(r'```json\s*(\{.*?\})\s*```', INITIAL_MESSAGE, re.DOTALL)
        if json_code_block:
            parsed = json.loads(json_code_block.group(1))
            agent_attribute_pairs = parsed.get("agents", parsed)
            message_type = parsed.get("message_type", "test_scenario")
            missing_data_types = parsed.get("missing_data_types", [])
            discovered_requirements = parsed.get("discovered_requirements", [])
    except Exception:
        pass

    display_text = re.sub(r'```json\s*\{.*?\}\s*```', '', INITIAL_MESSAGE, flags=re.DOTALL).strip()

    return {
        "success": True,
        "reply": display_text,
        "agent_attribute_pairs": agent_attribute_pairs,
        "message_type": message_type,
        "missing_data_types": missing_data_types,
        "discovered_requirements": discovered_requirements
    }


@app.post("/auth/register")
async def register_user(user: UserRegistration):
    """Register or login UCSD subject"""
    try:
        # Check if subject exists
        existing = supabase.table('ucsd_subjects')\
            .select('*')\
            .eq('subject_number', user.subject_number)\
            .execute()
        
        if existing.data and len(existing.data) > 0:
            # Subject exists, update last_login_at
            updated = supabase.table('ucsd_subjects')\
                .update({'last_login_at': 'now()'})\
                .eq('subject_number', user.subject_number)\
                .execute()
            
            return {
                "success": True,
                "user": existing.data[0],
                "message": "Welcome back!"
            }
        else:
            # New subject, insert
            new_subject = supabase.table('ucsd_subjects')\
                .insert({
                    'subject_number': user.subject_number,
                    'preferred_name': user.preferred_name
                })\
                .execute()
            
            return {
                "success": True,
                "user": new_subject.data[0],
                "message": "Registration successful!"
            }
    except Exception as e:
        print(f"ERROR in /auth/register: {type(e).__name__}: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/chat/send")
async def send_chat_message(chat: ChatMessage):
    """Send a chat message and get AI response with structured envelope."""
    try:
        import re

        # Build messages from conversation history + current message
        messages = []
        if chat.history:
            for turn in chat.history[-20:]:  # cap at last 20 turns
                messages.append({
                    "role": turn.get("role", "user"),
                    "content": turn.get("content", "")
                })

        user_content = chat.message
        if chat.timestamp_minutes is not None:
            user_content = f"[Timestamp: {chat.timestamp_minutes} minutes into study]\n\n{chat.message}"
        messages.append({"role": "user", "content": user_content})

        # Get monitor context (invisible to student) to steer Alex's probing
        monitor_context = learning_monitor.get_alex_context()
        alex_system = SYSTEM_PROMPT + monitor_context

        # Call Anthropic API with prompt caching
        # Block 1: KLI + BlueSky (static, cached across all calls)
        # Block 2: Alex prompt + monitor diagnosis (changes per turn)
        response = anthropic_client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=4096,
            system=[
                {
                    "type": "text",
                    "text": KLI_SECTION_3_1 + "\n\n" + BLUESKY_SECTION_3_1,
                    "cache_control": {"type": "ephemeral"}
                },
                {
                    "type": "text",
                    "text": alex_system
                }
            ],
            messages=messages,
            thinking={
                "type": "enabled",
                "budget_tokens": 2048
            }
        )

        # Extract response content
        reply_text = ""
        thinking_text = ""
        for block in response.content:
            if block.type == "thinking":
                thinking_text = block.thinking
            elif block.type == "text":
                reply_text = block.text

        # Parse JSON envelope from response
        agent_attribute_pairs = {}
        message_type = "clarification"
        missing_data_types = []
        discovered_requirements = []
        try:
            json_code_block = re.search(r'```json\s*(\{.*?\})\s*```', reply_text, re.DOTALL)
            if json_code_block:
                parsed = json.loads(json_code_block.group(1))
                # New envelope format: has "agents" key
                if "agents" in parsed:
                    agent_attribute_pairs = parsed["agents"]
                    message_type = parsed.get("message_type", "clarification")
                    missing_data_types = parsed.get("missing_data_types", [])
                    discovered_requirements = parsed.get("discovered_requirements", [])
                else:
                    # Fallback: bare agent JSON (rider_1, vehicle_1 at top level)
                    agent_attribute_pairs = parsed
            else:
                # Try to find raw JSON object
                json_match = re.search(r'\{(?:[^{}]|(?:\{[^{}]*\}))*\}', reply_text, re.DOTALL)
                if json_match:
                    parsed = json.loads(json_match.group())
                    if "agents" in parsed:
                        agent_attribute_pairs = parsed["agents"]
                        message_type = parsed.get("message_type", "clarification")
                    else:
                        agent_attribute_pairs = parsed
        except Exception as e:
            print(f"JSON parsing error: {e}")

        # Run the learning monitor asynchronously (student never sees this)
        # Include the assistant reply in history for analysis
        monitor_history = list(messages)  # copy
        monitor_history.append({"role": "assistant", "content": reply_text})
        try:
            monitor_state = learning_monitor.analyze(monitor_history)
            print(f"Monitor: {json.dumps(monitor_state, indent=2)[:500]}")
        except Exception as me:
            print(f"Monitor analysis failed (non-blocking): {me}")

        return {
            "success": True,
            "reply": reply_text,
            "agent_attribute_pairs": agent_attribute_pairs,
            "reasoning": thinking_text if thinking_text else None,
            "message_type": message_type,
            "missing_data_types": missing_data_types,
            "discovered_requirements": discovered_requirements
        }

    except Exception as e:
        print(f"ERROR in /chat/send: {type(e).__name__}: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/consent/submit")
async def submit_consent(consent: ConsentSubmission):
    """Submit signed consent form to Supabase storage"""
    try:
        print(f"Received consent data: {consent.model_dump()}")

        # Insert consent data into database
        insert_data = {
            'subject_number': consent.subject_number,
            'participant_signature': consent.participant_signature,
            'participant_date': consent.participant_date,
            'printed_name': consent.printed_name,
            'submitted_at': consent.submitted_at
        }
        
        # Only add user_id if it's provided
        if consent.user_id:
            insert_data['user_id'] = consent.user_id
        
        result = supabase_admin.table('consent_forms')\
            .insert(insert_data)\
            .execute()
        
        return {
            "success": True,
            "message": "Consent form submitted successfully",
            "data": result.data[0] if result.data else None
        }
    except Exception as e:
        print(f"ERROR in /consent/submit: {type(e).__name__}: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# ============= PRE-ASSESSMENT ENDPOINTS =============

@app.post("/assessment/pre/start")
async def start_pre_assessment(data: AssessmentStart):
    """Start a new pre-assessment or return existing draft"""
    try:
        # Check if user already has a pre-assessment
        existing = supabase_admin.table('pre_assessments')\
            .select('*')\
            .eq('user_id', data.user_id)\
            .execute()

        if existing.data and len(existing.data) > 0:
            return {
                "success": True,
                "assessment": existing.data[0],
                "message": "Existing assessment found"
            }

        # Create new pre-assessment
        result = supabase_admin.table('pre_assessments')\
            .insert({
                'user_id': data.user_id,
                'subject_number': data.subject_number,
                'responses': {}
            })\
            .execute()

        return {
            "success": True,
            "assessment": result.data[0] if result.data else None,
            "message": "Pre-assessment started"
        }
    except Exception as e:
        print(f"ERROR in /assessment/pre/start: {type(e).__name__}: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/assessment/pre/{user_id}")
async def get_pre_assessment(user_id: str):
    """Get pre-assessment for a user"""
    try:
        result = supabase_admin.table('pre_assessments')\
            .select('*')\
            .eq('user_id', user_id)\
            .execute()

        if not result.data or len(result.data) == 0:
            raise HTTPException(status_code=404, detail="Assessment not found")

        return {
            "success": True,
            "assessment": result.data[0]
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"ERROR in /assessment/pre/{{user_id}}: {type(e).__name__}: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/assessment/pre/{assessment_id}")
async def update_pre_assessment(assessment_id: str, data: AssessmentUpdate):
    """Update pre-assessment responses"""
    try:
        result = supabase_admin.table('pre_assessments')\
            .update({'responses': data.responses})\
            .eq('id', assessment_id)\
            .execute()

        return {
            "success": True,
            "assessment": result.data[0] if result.data else None,
            "message": "Assessment updated"
        }
    except Exception as e:
        print(f"ERROR in /assessment/pre/{{assessment_id}}: {type(e).__name__}: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/assessment/pre/{assessment_id}/submit")
async def submit_pre_assessment(assessment_id: str):
    """Submit pre-assessment"""
    try:
        result = supabase_admin.table('pre_assessments')\
            .update({
                'status': 'submitted',
                'submitted_at': 'now()'
            })\
            .eq('id', assessment_id)\
            .execute()

        return {
            "success": True,
            "assessment": result.data[0] if result.data else None,
            "message": "Assessment submitted"
        }
    except Exception as e:
        print(f"ERROR in /assessment/pre/{{assessment_id}}/submit: {type(e).__name__}: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# ============= POST-ASSESSMENT ENDPOINTS =============

@app.post("/assessment/post/start")
async def start_post_assessment(data: AssessmentStart):
    """Start a new post-assessment or return existing draft"""
    try:
        # Check if user already has a post-assessment
        existing = supabase_admin.table('post_assessments')\
            .select('*')\
            .eq('user_id', data.user_id)\
            .execute()

        if existing.data and len(existing.data) > 0:
            return {
                "success": True,
                "assessment": existing.data[0],
                "message": "Existing assessment found"
            }

        # Create new post-assessment
        result = supabase_admin.table('post_assessments')\
            .insert({
                'user_id': data.user_id,
                'subject_number': data.subject_number,
                'responses': {}
            })\
            .execute()

        return {
            "success": True,
            "assessment": result.data[0] if result.data else None,
            "message": "Post-assessment started"
        }
    except Exception as e:
        print(f"ERROR in /assessment/post/start: {type(e).__name__}: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/assessment/post/{user_id}")
async def get_post_assessment(user_id: str):
    """Get post-assessment for a user"""
    try:
        result = supabase_admin.table('post_assessments')\
            .select('*')\
            .eq('user_id', user_id)\
            .execute()

        if not result.data or len(result.data) == 0:
            raise HTTPException(status_code=404, detail="Assessment not found")

        return {
            "success": True,
            "assessment": result.data[0]
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"ERROR in /assessment/post/{{user_id}}: {type(e).__name__}: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/assessment/post/{assessment_id}")
async def update_post_assessment(assessment_id: str, data: AssessmentUpdate):
    """Update post-assessment responses"""
    try:
        result = supabase_admin.table('post_assessments')\
            .update({'responses': data.responses})\
            .eq('id', assessment_id)\
            .execute()

        return {
            "success": True,
            "assessment": result.data[0] if result.data else None,
            "message": "Assessment updated"
        }
    except Exception as e:
        print(f"ERROR in /assessment/post/{{assessment_id}}: {type(e).__name__}: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/assessment/post/{assessment_id}/submit")
async def submit_post_assessment(assessment_id: str):
    """Submit post-assessment"""
    try:
        result = supabase_admin.table('post_assessments')\
            .update({
                'status': 'submitted',
                'submitted_at': 'now()'
            })\
            .eq('id', assessment_id)\
            .execute()

        return {
            "success": True,
            "assessment": result.data[0] if result.data else None,
            "message": "Assessment submitted"
        }
    except Exception as e:
        print(f"ERROR in /assessment/post/{{assessment_id}}/submit: {type(e).__name__}: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/simulation/status")
async def get_simulation_status():
    """Get current simulation status"""
    return {
        "status": "idle",
        "grid_size": 30,
        "entities": []
    }


@app.post("/simulation/start")
async def start_simulation():
    """Start the simulation"""
    return {"status": "started"}


@app.post("/simulation/stop")
async def stop_simulation():
    """Stop the simulation"""
    return {"status": "stopped"}



if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
