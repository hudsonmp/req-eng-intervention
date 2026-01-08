from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from anthropic import Anthropic
from supabase import create_client
import os
from dotenv import load_dotenv

load_dotenv(dotenv_path="../../.env")

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize clients
anthropic = Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5odHR5cHBrY2Fqb2RvY3JucWhpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQzOTA5ODIsImV4cCI6MjA3OTk2Njk4Mn0.XbeUEF567uamBuqG8BlE_90p5zLQWlDd_L4WsmPfA7M"
SUPABASE_URL = os.getenv("SUPABASE_URL", "").rstrip("/") + "/"
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

def get_system_prompt() -> str:
    """Fetch system prompt from storage bucket"""
    try:
        response = supabase.storage.from_("system_prompts").download("1.1")
        return response.decode("utf-8")
    except Exception as e:
        print(f"Error fetching system prompt: {e}")
        return "You are a helpful assistant conducting a requirements engineering interview."

def get_golden_requirements() -> str:
    """Fetch golden requirements from storage bucket"""
    try:
        response = supabase.storage.from_("golden_requirements").download("1g.1")
        return response.decode("utf-8")
    except Exception as e:
        print(f"Error fetching golden requirements: {e}")
        return ""

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
        
        # Save metadata to messages table
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
    viewpoint: str
    scenario: str
    expectedBehavior: str
    dataRequired: str
    conflict: str
    resolution: str

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
            content = f"Viewpoint: {row.viewpoint}\nScenario: {row.scenario}\nExpected: {row.expectedBehavior}\nData: {row.dataRequired}\nConflict: {row.conflict}\nResolution: {row.resolution}"
            
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
                "viewpoint": row.viewpoint if row.viewpoint else None,
                "scenario": row.scenario,
                "expected_behavior": row.expectedBehavior,
                "data_required": row.dataRequired,
                "conflict": row.conflict,
                "resolution": row.resolution,
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
