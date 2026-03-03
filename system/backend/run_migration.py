#!/usr/bin/env python3
"""Apply database migration for consent_forms table using psycopg2"""
import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

# Read migration SQL
with open('migrations/001_create_consent_forms.sql', 'r') as f:
    migration_sql = f.read()

# Connect to database
conn_string = os.getenv("SUPABASE_CONNECTION_STRING")
print(f"Connecting to database...")

try:
    conn = psycopg2.connect(conn_string)
    cursor = conn.cursor()

    print("Executing migration...")
    cursor.execute(migration_sql)
    conn.commit()

    print("✓ Migration applied successfully!")
    print("\nVerifying table creation...")

    cursor.execute("""
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_name = 'consent_forms'
        ORDER BY ordinal_position;
    """)

    columns = cursor.fetchall()
    print("\nTable structure:")
    for col in columns:
        print(f"  - {col[0]}: {col[1]}")

    cursor.close()
    conn.close()

except Exception as e:
    print(f"❌ Error applying migration: {e}")
    import traceback
    traceback.print_exc()
