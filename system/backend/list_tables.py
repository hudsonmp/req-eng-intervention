"""
Try to discover what tables exist in the database
"""
from supabase import create_client, Client
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_ANON_KEY")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

print("=== Discovering Tables ===\n")

# Common table names to try
table_names = [
    "studies", "participants", "users", "sessions",
    "study_types", "study_sessions", "assessments",
    "interventions", "results", "responses"
]

for table_name in table_names:
    try:
        response = supabase.table(table_name).select("*").limit(1).execute()
        if response.data:
            print(f"✓ Table '{table_name}' exists")
            if len(response.data) > 0:
                columns = list(response.data[0].keys())
                print(f"  Columns: {columns}")
        else:
            print(f"✓ Table '{table_name}' exists (empty)")
    except Exception as e:
        if "does not exist" in str(e) or "not found" in str(e).lower():
            print(f"✗ Table '{table_name}' does not exist")
        else:
            print(f"? Table '{table_name}' - Error: {e}")

print("\n=== Checking 'studies' table more carefully ===")
try:
    # Get all records to see the pattern
    response = supabase.table("studies").select("*").execute()
    print(f"\nAll studies data:")
    for record in response.data:
        print(f"  {record}")
except Exception as e:
    print(f"Error: {e}")
