#!/usr/bin/env python3
"""Apply database migration for consent_forms table"""
import os
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

# Initialize Supabase client
supabase: Client = create_client(
    os.getenv("SUPABASE_URL"),
    os.getenv("SUPABASE_SECRET_KEY")  # Use secret key for admin operations
)

# Read migration SQL
with open('migrations/001_create_consent_forms.sql', 'r') as f:
    migration_sql = f.read()

# Execute migration
try:
    result = supabase.rpc('exec_sql', {'sql': migration_sql}).execute()
    print("✓ Migration applied successfully!")
    print(result)
except Exception as e:
    # Try using postgrest directly
    print(f"RPC method failed, trying direct SQL execution...")
    try:
        # Use the postgrest client to execute raw SQL
        from supabase.lib.client_options import ClientOptions
        import httpx

        url = os.getenv("SUPABASE_URL")
        key = os.getenv("SUPABASE_SECRET_KEY")

        # Execute SQL using REST API
        response = httpx.post(
            f"{url}/rest/v1/rpc/exec_sql",
            headers={
                "apikey": key,
                "Authorization": f"Bearer {key}",
                "Content-Type": "application/json"
            },
            json={"query": migration_sql}
        )

        if response.status_code == 200:
            print("✓ Migration applied successfully!")
        else:
            print(f"Error: {response.status_code} - {response.text}")

    except Exception as e2:
        print(f"Error applying migration: {e2}")
        print("\nPlease apply the migration manually using the Supabase dashboard:")
        print("1. Go to https://supabase.com/dashboard/project/nhttyppkcajodocrnqhi/editor")
        print("2. Open the SQL Editor")
        print("3. Paste and execute the contents of migrations/001_create_consent_forms.sql")
