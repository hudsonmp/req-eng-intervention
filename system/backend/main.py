from fastapi import FastAPI, WebSocket, HTTPException, Request
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

# Supabase REST API endpoints
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_ANON_KEY")

# System prompt for teachable agent framework
SYSTEM_PROMPT = """You are "Alex," an AI-simulated CS1 student using the teachable agent framework. You are building a rideshare matching system and need help from a TA (the human participant) because your code has bugs and missing requirements.

DOMAIN: A city operates autonomous vehicles providing on-demand rides. Passengers request rides via an app; the system matches them to vehicles minimizing wait time and pickup distance.

YOUR ROLE: You are the student asking for help. You deliberately make three types of errors for the TA to discover through testing:
1. OMISSION — you leave out required data fields (e.g., no request_time, no is_accessible on vehicles)
2. COMMISSION — your logic has bugs or ignores boundary cases (e.g., no tie-breaking when distances are equal)
3. AMBIGUITY — your requirements are underspecified (e.g., "closest vehicle" without defining the distance metric)

You do NOT fill in gaps yourself. If the TA's instructions are ambiguous, you interpret them literally (even incorrectly) to force them to be precise.

AGENTS IN THE SYSTEM:
- Riders (up to 5): pickup_location, destination, request_time, accessible, eta_destination
- Vehicles (up to 3): car_cur_location, pickup_distance, occupied, assigned_other, eta_car, accessible, distance_dropoff
- System: the matching orchestrator

PROGRESSION: Start simple (just distance between one car and one rider), then gradually increase complexity as the TA helps you discover more requirements. Introduce new attributes only when the TA's feedback reveals they're needed.

PEDAGOGY: Every question you ask must serve a purpose — either surfacing a missing requirement, exposing a boundary condition, or testing whether the TA's fix actually resolves the issue. Never ask rhetorical questions. Always propose a concrete test scenario.

TESTS: When you or the TA propose a test, describe it in natural language like:
"Test: Two riders at equal distance from one vehicle, but Rider 1 requested first. Expected: Rider 1 gets assigned."
Then include the structured data so it can be visualized.

CRITICAL FORMAT — Every response MUST include both:
1. Your conversational message to the TA
2. A JSON code block with the current test scenario's agent-attribute-value pairs

```json
{
  "rider_1": { "pickup_location": "(x, y)", ... },
  "vehicle_1": { "car_cur_location": "(x, y)", ... }
}
```

Coordinates are (x, y) integers 0–29 for the simulation grid. Example: Airport "(15, 15)", 1 mile north "(15, 12)", 2 miles east "(21, 15)".

Keep messages concise. You are a confused but earnest student, not a lecturer."""


# Initial message from the teachable agent (sent before any user input)
INITIAL_MESSAGE = """Hi! I'm Alex, and I'm in CS 101. I'm trying to build a rideshare matching system for my project, but my code isn't working right and I could really use your help.

Here's what I have so far: a city with autonomous vehicles that pick up passengers. When someone requests a ride, my system is supposed to match them with the closest available vehicle. But I'm getting weird results and I think my matching logic might be broken.

Can I walk you through a simple test case? I have one vehicle parked near the airport and one rider requesting a pickup. Let me show you what I mean:

```json
{
  "rider_1": {
    "pickup_location": "(15, 20)"
  },
  "vehicle_1": {
    "car_cur_location": "(15, 12)"
  }
}
```

The vehicle is about 8 blocks north of the rider. My system says it should be assigned — does that seem right to you? I want to make sure my basic matching works before I add more riders."""


class UserRegistration(BaseModel):
    subject_number: int
    preferred_name: str


class ChatMessage(BaseModel):
    user_id: str  # UUID from ucsd_subjects table
    message: str
    timestamp_minutes: Optional[int] = None  # How many minutes into the study


class ChatResponse(BaseModel):
    reply: str
    agent_attribute_pairs: Dict[str, Any]
    reasoning: Optional[str] = None


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

# Store active websocket connections
active_connections: List[WebSocket] = []


@app.get("/")
async def root():
    return {"message": "Rideshare Simulation API"}


@app.get("/chat/init")
async def chat_init():
    """Return the initial teachable agent message and parsed JSON."""
    import re
    agent_attribute_pairs = {}
    try:
        json_code_block = re.search(r'```json\s*(\{.*?\})\s*```', INITIAL_MESSAGE, re.DOTALL)
        if json_code_block:
            agent_attribute_pairs = json.loads(json_code_block.group(1))
    except Exception:
        pass

    display_text = re.sub(r'```json\s*\{.*?\}\s*```', '', INITIAL_MESSAGE, flags=re.DOTALL).strip()

    return {
        "success": True,
        "reply": display_text,
        "agent_attribute_pairs": agent_attribute_pairs
    }


@app.post("/chat/translate-test")
async def translate_test(data: ChatMessage):
    """Translate a natural language test into structured agent-attribute pairs."""
    translate_prompt = """You are a test case translator for a rideshare matching simulation.

Given a natural language test description, output ONLY a JSON object with the following structure.

AGENTS:
- rider_N: pickup_location "(x,y)", destination "(x,y)", request_time (int minutes), accessible (bool)
- vehicle_N: car_cur_location "(x,y)", occupied (bool), accessible (bool)

Coordinates are (x, y) integers 0-29 for a 30x30 grid.

Output format (JSON only, no other text):
{
  "test_code": { ...agents with their attributes... },
  "description": "Brief description of what this test checks and expected behavior",
  "note": "What requirement or edge case this test targets"
}"""

    try:
        response = anthropic_client.messages.create(
            model="claude-sonnet-4-6-20250514",
            max_tokens=1024,
            system=translate_prompt,
            messages=[{
                "role": "user",
                "content": data.message
            }]
        )

        reply_text = ""
        for block in response.content:
            if block.type == "text":
                reply_text = block.text

        import re
        result = {}
        try:
            result = json.loads(reply_text)
        except Exception:
            json_match = re.search(r'```(?:json)?\s*(\{.*?\})\s*```', reply_text, re.DOTALL)
            if json_match:
                result = json.loads(json_match.group(1))

        return {
            "success": True,
            "test_code": result.get("test_code", {}),
            "description": result.get("description", ""),
            "note": result.get("note", "")
        }
    except Exception as e:
        print(f"ERROR in /chat/translate-test: {type(e).__name__}: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


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
    """Send a chat message and get AI response with agent-attribute pairs"""
    try:
        # Build messages (no database, just current message)
        user_content = chat.message
        if chat.timestamp_minutes is not None:
            user_content = f"[Timestamp: {chat.timestamp_minutes} minutes into study]\n\n{chat.message}"
        
        messages = [{
            "role": "user",
            "content": user_content
        }]
        
        # Call Anthropic API with prompt caching
        response = anthropic_client.messages.create(
            model="claude-sonnet-4-6-20250514",
            max_tokens=2048,
            system=[{
                "type": "text",
                "text": SYSTEM_PROMPT,
                "cache_control": {"type": "ephemeral"}
            }],
            messages=messages,
            thinking={
                "type": "enabled",
                "budget_tokens": 1024
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
        
        # Parse JSON from response (expecting agent-attribute pairs in JSON format)
        agent_attribute_pairs = {}
        try:
            # Try to extract JSON from markdown code blocks first
            import re
            json_code_block = re.search(r'```json\s*(\{.*?\})\s*```', reply_text, re.DOTALL)
            if json_code_block:
                agent_attribute_pairs = json.loads(json_code_block.group(1))
            else:
                # Try to find raw JSON object
                json_match = re.search(r'\{(?:[^{}]|(?:\{[^{}]*\}))*\}', reply_text, re.DOTALL)
                if json_match:
                    agent_attribute_pairs = json.loads(json_match.group())
        except Exception as e:
            print(f"JSON parsing error: {e}")
            # If no JSON found, return empty dict
            agent_attribute_pairs = {}
        
        # Return response without storing in database
        return {
            "success": True,
            "reply": reply_text,
            "agent_attribute_pairs": agent_attribute_pairs,
            "reasoning": thinking_text if thinking_text else None
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


@app.websocket("/ws/chat")
async def websocket_chat(websocket: WebSocket):
    """WebSocket endpoint for chat communication"""
    await websocket.accept()
    active_connections.append(websocket)
    
    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            
            # Echo back for now (replace with actual chat logic)
            response = {
                "sender": "student",
                "text": f"Received: {message.get('text', '')}"
            }
            
            await websocket.send_text(json.dumps(response))
    except Exception as e:
        print(f"WebSocket error: {e}")
    finally:
        active_connections.remove(websocket)


@app.websocket("/ws/simulation")
async def websocket_simulation(websocket: WebSocket):
    """WebSocket endpoint for simulation updates"""
    await websocket.accept()
    active_connections.append(websocket)
    
    try:
        while True:
            # Send simulation updates
            data = await websocket.receive_text()
            # Process simulation commands if needed
            pass
    except Exception as e:
        print(f"WebSocket error: {e}")
    finally:
        active_connections.remove(websocket)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
