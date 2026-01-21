"""
Add a 'type' column to the studies table and populate it from 'phase'
"""
from supabase import create_client, Client
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_ANON_KEY")

# Note: We might need a service role key to alter tables
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SECRET_KEY")

if SUPABASE_SERVICE_KEY:
    print("Using service key for admin operations")
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
else:
    print("Using anon key (might not have permission to alter table)")
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

print("=== Adding 'type' column to studies table ===\n")

# Try to add the type column using raw SQL
sql_add_column = """
ALTER TABLE studies
ADD COLUMN IF NOT EXISTS type TEXT;
"""

sql_update_type = """
UPDATE studies
SET type = CASE
    WHEN phase = 'pre' THEN 'pre-assessment'
    WHEN phase = 'intervention' THEN 'intervention'
    WHEN phase = 'post' THEN 'post-assessment'
    ELSE phase
END;
"""

print("Step 1: Adding 'type' column...")
try:
    response = supabase.rpc('exec_sql', {'query': sql_add_column}).execute()
    print("Success!")
except Exception as e:
    print(f"Error (this might be expected if using anon key): {e}")
    print("\nYou need to run this SQL manually in Supabase SQL Editor:")
    print(sql_add_column)
    print("\nThen run:")
    print(sql_update_type)

print("\n=== Alternative: Using phase column directly ===")
print("The code can use the 'phase' column and map it to the route.")
print("Current mapping:")
print("  'pre' -> 'pre-assessment'")
print("  'intervention' -> 'intervention'")
print("  'post' -> 'post-assessment'")
