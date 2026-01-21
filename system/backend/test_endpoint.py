"""
Test the endpoint directly to verify it works
"""
from supabase import create_client, Client
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_ANON_KEY")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

print("=== Testing Study Type Endpoint Logic ===\n")

# Test the logic for each study
for study_id in [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]:
    try:
        response = supabase.table("studies").select("phase").eq("study_id", study_id).execute()

        if response.data and len(response.data) > 0:
            study_phase = response.data[0]["phase"]

            # Map phase to type
            phase_to_type = {
                "pre": "pre-assessment",
                "intervention": "intervention",
                "post": "post-assessment"
            }

            study_type = phase_to_type.get(study_phase, study_phase)
            print(f"Study {study_id}: phase='{study_phase}' -> type='{study_type}'")
        else:
            print(f"Study {study_id}: NOT FOUND")
    except Exception as e:
        print(f"Study {study_id}: ERROR - {e}")

print("\n=== Test Complete ===")
