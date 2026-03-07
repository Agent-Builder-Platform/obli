"""
Seed default system prompts into the database.

Reads prompt content from db/default_prompts/*.txt and inserts them as
system-owned prompts (user_id = NULL). Safe to run multiple times — existing
prompts with the same name are skipped.

Usage:
    cd <repo-root>
    python db/seed_defaults.py

Requires SUPABASE_URL and SUPABASE_SERVICE_KEY to be set in the environment
or in backend/.env.
"""

import os
import sys
from pathlib import Path
from dotenv import load_dotenv

# ---------------------------------------------------------------------------
# Load environment from backend/.env if not already set
# ---------------------------------------------------------------------------
try:
    env_file = Path(__file__).parent.parent / "backend" / ".env"
    if env_file.exists():
        load_dotenv(env_file)
except ImportError:
    pass  # python-dotenv not installed; rely on environment variables directly

# ---------------------------------------------------------------------------
# Validate environment
# ---------------------------------------------------------------------------
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    print(
        "ERROR: SUPABASE_URL and SUPABASE_SERVICE_KEY must be set.\n"
        "       Set them in backend/.env or export them before running this script.",
        file=sys.stderr,
    )
    sys.exit(1)

# ---------------------------------------------------------------------------
# Connect to Supabase using the service role key (bypasses RLS)
# ---------------------------------------------------------------------------
try:
    from supabase import create_client
except ImportError:
    print(
        "ERROR: supabase-py is not installed.\n"
        "       Run: pip install supabase",
        file=sys.stderr,
    )
    sys.exit(1)

client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

# ---------------------------------------------------------------------------
# Define the default prompts
# Each entry maps a display name to the corresponding .txt file.
# ---------------------------------------------------------------------------
PROMPTS_DIR = Path(__file__).parent / "default_prompts"

DEFAULT_PROMPTS = [
    {
        "name": "Senior Software Engineer",
        "file": "senior_software_engineer.txt",
    },
    {
        "name": "Software Architect",
        "file": "software_architect.txt",
    },
    {
        "name": "Product Manager",
        "file": "product_manager.txt",
    },
    {
        "name": "Product Owner",
        "file": "product_owner.txt",
    },
]

# ---------------------------------------------------------------------------
# Fetch names of existing system-default prompts to avoid duplicates
# ---------------------------------------------------------------------------
existing_response = (
    client.table("system_prompts")
    .select("name")
    .is_("user_id", "null")
    .execute()
)
existing_names = {row["name"] for row in (existing_response.data or [])}

# ---------------------------------------------------------------------------
# Insert missing prompts
# ---------------------------------------------------------------------------
inserted = 0
skipped = 0

for prompt in DEFAULT_PROMPTS:
    name = prompt["name"]

    if name in existing_names:
        print(f"  SKIP   {name!r} (already exists)")
        skipped += 1
        continue

    txt_path = PROMPTS_DIR / prompt["file"]
    if not txt_path.exists():
        print(f"  ERROR  {name!r}: file not found at {txt_path}", file=sys.stderr)
        continue

    content = txt_path.read_text(encoding="utf-8").strip()

    response = (
        client.table("system_prompts")
        .insert({"name": name, "content": content, "user_id": None})
        .execute()
    )

    if response.data:
        print(f"  INSERT {name!r}")
        inserted += 1
    else:
        print(f"  ERROR  {name!r}: insert failed — {response}", file=sys.stderr)

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
print(f"\nDone. {inserted} inserted, {skipped} skipped.")
