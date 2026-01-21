from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from supabase import create_client, Client
from pydantic import BaseModel
import os
from dotenv import load_dotenv
import anthropic

# Load environment variables
load_dotenv()

# Initialize FastAPI app
app = FastAPI()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Supabase client
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_ANON_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError("Missing Supabase credentials in environment variables")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Initialize Anthropic client
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
if not ANTHROPIC_API_KEY:
    print("Warning: ANTHROPIC_API_KEY not found in environment variables")
    anthropic_client = None
else:
    anthropic_client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

# Request models
class UserTypesFeedbackRequest(BaseModel):
    user_types: list[str]

class GenerateActionsRequest(BaseModel):
    user_type: str

class ScenarioRequest(BaseModel):
    scenario: str

class PreAssessmentResponse(BaseModel):
    study_id: int
    participant_id: str
    system_reflection: str
    user_type_1: str
    user_type_2: str
    user_type_3: str
    user_types_feedback: str
    selected_actions: list[str]
    stakeholder2_actions: str
    stakeholder3_actions: str
    closed_restaurant_answer: str
    cancellation_answer: str
    important_info_answer: str
    data_collection: dict
    data_reflection: str
    concurrent_booking_answer: str
    concurrent_booking_selected_data: list[str]
    table_allocation_answer: str
    table_allocation_selected_data: list[str]
    custom_scenario: str
    custom_scenario_response: str
    combined_iterations: list[dict]

@app.post("/pre-assessment/user-types-feedback")
async def get_user_types_feedback(request: UserTypesFeedbackRequest):
    """
    Analyze user types submitted by student and provide feedback using Claude.
    """
    if not anthropic_client:
        return {"feedback": "Unable to provide feedback at this time."}

    user_types = request.user_types

    # Construct prompt for Claude
    prompt = f"""You are evaluating a student's answer to the question: "What are the different types of users that would use a dinner reservation system?"

The student provided these user types:
{', '.join(user_types)}

Analyze whether these user types are too narrow or focus on irrelevant characteristics (like demographics: "hungry customer", "female customer", etc.) rather than different user roles or stakeholder types.

If the answer is too narrow or focuses on irrelevant characteristics, provide concise feedback (no more than 2 sentences) suggesting they consider the different types of users or roles in a reservation system.

If the answer shows good thinking about different user roles (e.g., restaurant owner, diner, staff, host), provide brief positive feedback (no more than 2 sentences).

Provide only the feedback text, nothing else."""

    try:
        message = anthropic_client.messages.create(
            model="claude-3-haiku-20240307",
            max_tokens=150,
            messages=[
                {"role": "user", "content": prompt}
            ]
        )

        feedback = message.content[0].text
        return {"feedback": feedback}

    except Exception as e:
        print(f"Error calling Claude API: {e}")
        return {"feedback": "Unable to provide feedback at this time."}

@app.post("/pre-assessment/generate-actions")
async def generate_actions(request: GenerateActionsRequest):
    """
    Generate action options for a specific user type using Claude.
    Includes both relevant actions and distractor options.
    """
    if not anthropic_client:
        return {"actions": []}

    user_type = request.user_type

    # Construct prompt for Claude
    prompt = f"""You are helping design a dinner reservation system. Generate a list of exactly 6 actions for the user type: "{user_type}".

Context: This is for a restaurant reservation system where diners can make reservations and restaurant owners/staff can manage them.

Generate 6 actions where:
- 4 actions should be RELEVANT and appropriate for this user type
- 2 actions should be DISTRACTORS (actions that seem plausible but aren't really appropriate for this user type or are too granular/specific)

For example, if the user type is "Restaurant Owner":
- Relevant: "Set available time slots", "View all reservations", "Close restaurant for a day", "Set maximum party size"
- Distractors: "Choose background music for restaurant", "Approve individual customer reviews"

Return ONLY a JSON array of 6 action strings, nothing else. Do not include explanations or labels.
Example format: ["action 1", "action 2", "action 3", "action 4", "action 5", "action 6"]"""

    try:
        message = anthropic_client.messages.create(
            model="claude-3-haiku-20240307",
            max_tokens=300,
            messages=[
                {"role": "user", "content": prompt}
            ]
        )

        response_text = message.content[0].text.strip()

        # Parse JSON response
        import json
        actions = json.loads(response_text)

        return {"actions": actions}

    except Exception as e:
        print(f"Error calling Claude API: {e}")
        # Fallback actions
        return {"actions": [
            "View reservation details",
            "Make a reservation",
            "Cancel a reservation",
            "Update contact information",
            "Choose seat color preference",
            "Set dietary restrictions"
        ]}

@app.post("/pre-assessment/generate-scenario-response")
async def generate_scenario_response(request: ScenarioRequest):
    """
    Generate a sample response to a student's "what if" scenario using Claude.
    """
    if not anthropic_client:
        return {"response": "Unable to provide a response at this time."}

    scenario = request.scenario

    # Construct prompt for Claude
    prompt = f"""You are providing a sample response to a student's "what if" scenario for a restaurant reservation system.

The student wrote the following scenario:
"{scenario}"

Provide a thoughtful 2-3 sentence response that:
1. Acknowledges the scenario they constructed
2. Suggests how the system might handle this situation based on the data types involved
3. Encourages them to think about edge cases or additional considerations

Keep the response concise and constructive. Provide only the response text, nothing else."""

    try:
        message = anthropic_client.messages.create(
            model="claude-3-haiku-20240307",
            max_tokens=200,
            messages=[
                {"role": "user", "content": prompt}
            ]
        )

        response_text = message.content[0].text
        return {"response": response_text}

    except Exception as e:
        print(f"Error calling Claude API: {e}")
        return {"response": "Unable to provide a response at this time."}

@app.post("/pre-assessment/initialize-table")
async def initialize_pre_assessment_table():
    """
    Initialize the pre_assessment_responses table in Supabase.
    This endpoint reads and executes the SQL migration file.
    """
    try:
        # Read the SQL file
        sql_file_path = os.path.join(os.path.dirname(__file__), "create_pre_assessment_table.sql")
        with open(sql_file_path, 'r') as f:
            sql = f.read()

        # Execute the SQL via Supabase RPC
        # Note: This requires the SQL to be executed with proper permissions
        # For now, we'll return the SQL for manual execution
        return {
            "status": "sql_ready",
            "message": "Please execute this SQL in your Supabase SQL editor",
            "sql": sql
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error initializing table: {str(e)}")

@app.post("/pre-assessment/submit")
async def submit_pre_assessment(response: PreAssessmentResponse):
    """
    Save a completed pre-assessment response to Supabase.
    """
    try:
        # Prepare data for insertion
        data = {
            "study_id": response.study_id,
            "participant_id": response.participant_id,
            "system_reflection": response.system_reflection,
            "user_type_1": response.user_type_1,
            "user_type_2": response.user_type_2,
            "user_type_3": response.user_type_3,
            "user_types_feedback": response.user_types_feedback,
            "selected_actions": response.selected_actions,
            "stakeholder2_actions": response.stakeholder2_actions,
            "stakeholder3_actions": response.stakeholder3_actions,
            "closed_restaurant_answer": response.closed_restaurant_answer,
            "cancellation_answer": response.cancellation_answer,
            "important_info_answer": response.important_info_answer,
            "data_collection": response.data_collection,
            "data_reflection": response.data_reflection,
            "concurrent_booking_answer": response.concurrent_booking_answer,
            "concurrent_booking_selected_data": response.concurrent_booking_selected_data,
            "table_allocation_answer": response.table_allocation_answer,
            "table_allocation_selected_data": response.table_allocation_selected_data,
            "custom_scenario": response.custom_scenario,
            "custom_scenario_response": response.custom_scenario_response,
            "combined_iterations": response.combined_iterations
        }

        # Insert into Supabase
        result = supabase.table("pre_assessment_responses").insert(data).execute()

        return {
            "status": "success",
            "message": "Pre-assessment response saved successfully",
            "id": result.data[0]["id"] if result.data else None
        }

    except Exception as e:
        print(f"Error saving pre-assessment response: {e}")
        raise HTTPException(status_code=500, detail=f"Error saving response: {str(e)}")

@app.get("/study/{study_id}/type")
async def get_study_type(study_id: int):
    """
    Get the type of study by study_id from Supabase.

    Queries the 'studies' table for the 'type' column (or 'phase' as fallback).
    """
    try:
        # Try to query with 'type' column first
        try:
            response = supabase.table("studies").select("type").eq("study_id", study_id).execute()
            if response.data and len(response.data) > 0 and response.data[0].get("type"):
                return {"type": response.data[0]["type"]}
        except:
            pass  # Type column doesn't exist, fall back to phase

        # Fall back to querying 'phase' column
        response = supabase.table("studies").select("phase").eq("study_id", study_id).execute()

        if not response.data or len(response.data) == 0:
            raise HTTPException(status_code=404, detail=f"Study with ID {study_id} not found")

        study_phase = response.data[0]["phase"]

        # Map phase to type for frontend compatibility
        phase_to_type = {
            "pre": "pre-assessment",
            "intervention": "intervention",
            "post": "post-assessment"
        }

        study_type = phase_to_type.get(study_phase, study_phase)
        return {"type": study_type}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "ok"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
