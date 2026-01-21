"""
Test script to check Supabase connection and studies table
"""
from supabase import create_client, Client
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_ANON_KEY")

print(f"Supabase URL: {SUPABASE_URL}")
print(f"Supabase Key exists: {bool(SUPABASE_KEY)}")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

print("\n=== Testing Supabase Connection ===\n")

# Test 1: Check if studies table exists and get all records
print("1. Querying all studies:")
try:
    response = supabase.table("studies").select("*").execute()
    print(f"   Success! Found {len(response.data)} studies")
    if response.data and len(response.data) > 0:
        print(f"\n   First study record (to see columns):")
        first_study = response.data[0]
        print(f"   Columns: {list(first_study.keys())}")
        print(f"   Data: {first_study}")
        print("\n   All studies:")
        for study in response.data:
            print(f"   - {study}")
except Exception as e:
    print(f"   Error: {e}")

# Test 2: Try to get a specific study by ID
print("\n2. Testing specific study lookups:")
for study_id in [1, 2, 3]:
    try:
        response = supabase.table("studies").select("type").eq("id", study_id).execute()
        if response.data and len(response.data) > 0:
            print(f"   Study {study_id}: type = '{response.data[0]['type']}'")
        else:
            print(f"   Study {study_id}: NOT FOUND")
    except Exception as e:
        print(f"   Study {study_id}: Error - {e}")

# Test 3: Check table schema
print("\n3. Checking available tables:")
try:
    # Try to list all tables by querying pg_tables (this might not work with anon key)
    response = supabase.rpc("list_tables").execute()
    print(f"   Tables: {response.data}")
except Exception as e:
    print(f"   Cannot list tables with anon key (expected): {e}")

print("\n=== Test Complete ===")
