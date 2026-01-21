"""
Check the actual schema of the studies table more carefully
"""
from supabase import create_client, Client
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_ANON_KEY")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

print("=== Checking Studies Table Schema ===\n")

# Try to get a single record with all columns
try:
    response = supabase.table("studies").select("*").limit(1).execute()
    if response.data and len(response.data) > 0:
        record = response.data[0]
        print("Columns found in studies table:")
        for key, value in record.items():
            print(f"  - {key}: {value} (type: {type(value).__name__})")
except Exception as e:
    print(f"Error: {e}")

print("\n=== Trying to select 'type' column specifically ===\n")
try:
    response = supabase.table("studies").select("type").limit(5).execute()
    print(f"Success! Found {len(response.data)} records with 'type' column:")
    for record in response.data:
        print(f"  - {record}")
except Exception as e:
    print(f"Error: {e}")

print("\n=== Getting all unique values ===\n")
try:
    response = supabase.table("studies").select("study_id, name, phase, type").execute()
    print(f"Found {len(response.data)} studies:")
    for record in response.data:
        print(f"  Study ID: {record.get('study_id')}, Name: {record.get('name')}, Phase: {record.get('phase')}, Type: {record.get('type')}")
except Exception as e:
    print(f"Error selecting with 'type' column: {e}")
    print("\nTrying without 'type' column:")
    try:
        response = supabase.table("studies").select("study_id, name, phase").execute()
        print(f"Found {len(response.data)} studies (without type):")
        for record in response.data:
            print(f"  Study ID: {record.get('study_id')}, Name: {record.get('name')}, Phase: {record.get('phase')}")
    except Exception as e2:
        print(f"Error: {e2}")
