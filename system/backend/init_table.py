#!/usr/bin/env python3
"""
Script to initialize the pre_assessment_responses table in Supabase.
Run this once to create the table.
"""

import os
from dotenv import load_dotenv
from supabase import create_client, Client

# Load environment variables
load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY") or os.getenv("SUPABASE_ANON_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError("Missing Supabase credentials in environment variables")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Read SQL file
sql_file_path = os.path.join(os.path.dirname(__file__), "create_pre_assessment_table.sql")
with open(sql_file_path, 'r') as f:
    sql = f.read()

print("SQL Migration:")
print("=" * 80)
print(sql)
print("=" * 80)
print("\nPlease execute this SQL in your Supabase SQL Editor:")
print(f"1. Go to {SUPABASE_URL.replace('supabase.co', 'supabase.com')}/project/_/sql")
print("2. Copy and paste the SQL above")
print("3. Click 'Run' to create the table")
print("\nNote: Direct SQL execution via API requires service role key and is not")
print("recommended for security reasons. Please use the SQL Editor instead.")
