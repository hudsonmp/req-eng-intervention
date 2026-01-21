#!/usr/bin/env python3
"""
Direct table creation using Supabase client
"""

import os
from dotenv import load_dotenv
from supabase import create_client, Client

# Load environment variables
load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_ANON_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError("Missing Supabase credentials in environment variables")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Read SQL file
sql_file_path = os.path.join(os.path.dirname(__file__), "create_pre_assessment_table.sql")
with open(sql_file_path, 'r') as f:
    sql = f.read()

try:
    # Try to execute via RPC
    # Note: This requires the SQL to be wrapped in a function or executed via PostgREST
    print("Attempting to create table...")

    # Use the rpc method to execute SQL
    response = supabase.rpc('exec_sql', {'query': sql}).execute()
    print("Table created successfully!")
    print(response)

except Exception as e:
    print(f"Error: {e}")
    print("\nThe Supabase anon key doesn't have permission to create tables.")
    print("Please use one of these methods instead:")
    print("\n1. Add SUPABASE_ACCESS_TOKEN to .env and restart Claude Code")
    print("   Get token from: https://supabase.com/dashboard/account/tokens")
    print("\n2. Or run this SQL manually in Supabase SQL Editor:")
    print(f"   https://supabase.com/dashboard/project/nhttyppkcajodocrnqhi/sql/new")
    print("\n" + "="*80)
    print(sql)
    print("="*80)
