"""
Check the actual schema using PostgreSQL directly
"""
import os
from dotenv import load_dotenv

load_dotenv()

connection_string = os.getenv("SUPABASE_CONNECTION_STRING")

print("=== SQL to run in Supabase SQL Editor ===\n")
print("-- Check if 'type' column exists:")
print("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'studies';")
print()
print("-- See all data with all columns:")
print("SELECT * FROM studies LIMIT 5;")
print()
print("-- If 'type' column doesn't exist, create it:")
print("ALTER TABLE studies ADD COLUMN IF NOT EXISTS type TEXT;")
print()
print("-- Populate type from phase:")
print("""UPDATE studies SET type = CASE
    WHEN phase = 'pre' THEN 'pre-assessment'
    WHEN phase = 'intervention' THEN 'intervention'
    WHEN phase = 'post' THEN 'post-assessment'
    ELSE phase
END WHERE type IS NULL;""")
print()
print("\n=== Or if you want 'type' to just copy 'phase' ===")
print("UPDATE studies SET type = phase WHERE type IS NULL;")
