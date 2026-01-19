#!/usr/bin/env python3
"""
Script to combine all notes from Supabase into one file
"""

import os
from datetime import datetime
from supabase import create_client, Client
from dotenv import load_dotenv

# Load environment variables from parent directory
load_dotenv("/Users/hudsonmitchell-pullman/req-eng-intervention/.env")

# Supabase configuration from environment
SUPABASE_URL = os.getenv("SUPABASE_URL", "").rstrip("/") + "/"
SUPABASE_KEY = os.getenv("SUPABASE_ANON_KEY")

# Initialize Supabase client
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def fetch_all_notes():
    """Fetch all notes from Supabase exploration bucket"""
    try:
        # List all files in exploration bucket
        all_files = supabase.storage.from_("exploration").list()

        notes = []
        for file in all_files:
            # Only process note files (notes_ or note_)
            if file["name"].startswith("note"):
                try:
                    # Download content
                    content_bytes = supabase.storage.from_("exploration").download(file["name"])
                    content = content_bytes.decode("utf-8")

                    # Determine display name
                    if file["name"].startswith("notes_"):
                        participant_id = file["name"].replace("notes_", "").replace(".txt", "")
                        display_name = f"Participant {participant_id}"
                    else:
                        display_name = file["name"].replace("note_", "").replace(".txt", "")

                    notes.append({
                        "id": file["name"],
                        "name": display_name,
                        "content": content,
                        "created_at": file.get("created_at", ""),
                        "updated_at": file.get("updated_at", "")
                    })
                    print(f"✓ Fetched: {display_name}")
                except Exception as e:
                    print(f"✗ Error fetching {file['name']}: {e}")

        # Sort by name (participant ID order)
        notes.sort(key=lambda x: x.get("name", ""))

        return notes
    except Exception as e:
        print(f"Error listing files: {e}")
        return []

def combine_notes(notes, output_path):
    """Combine all notes into one file"""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    with open(output_path, 'w', encoding='utf-8') as f:
        f.write("=" * 80 + "\n")
        f.write("COMBINED NOTES - Requirements Engineering Study\n")
        f.write(f"Generated: {timestamp}\n")
        f.write(f"Total Notes: {len(notes)}\n")
        f.write("=" * 80 + "\n\n")

        for note in notes:
            f.write("\n" + "=" * 80 + "\n")
            f.write(f"NOTE: {note['name']}\n")
            f.write(f"File: {note['id']}\n")
            f.write(f"Updated: {note.get('updated_at', 'Unknown')}\n")
            f.write("=" * 80 + "\n\n")
            f.write(note['content'])
            f.write("\n\n")

        f.write("\n" + "=" * 80 + "\n")
        f.write("END OF COMBINED NOTES\n")
        f.write("=" * 80 + "\n")

def main():
    print("Fetching all notes from Supabase...")
    notes = fetch_all_notes()

    if not notes:
        print("No notes found!")
        return

    print(f"\nFound {len(notes)} notes")

    # Ensure output directory exists
    output_dir = "/Users/hudsonmitchell-pullman/Desktop/Research/req-eng-study"
    os.makedirs(output_dir, exist_ok=True)

    # Create output filename with timestamp
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_path = os.path.join(output_dir, f"combined_notes_{timestamp}.txt")

    print(f"\nCombining notes into: {output_path}")
    combine_notes(notes, output_path)

    print(f"✓ Success! Combined {len(notes)} notes")
    print(f"  Output: {output_path}")

    # Also create a "latest" version without timestamp
    latest_path = os.path.join(output_dir, "combined_notes_latest.txt")
    combine_notes(notes, latest_path)
    print(f"  Also saved as: {latest_path}")

if __name__ == "__main__":
    main()
