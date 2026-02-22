"""
Seed meeting templates from project prompt files.

Loads Prompts/standard.txt as a template named 'Standard' with is_default=True if missing.
Run on app startup or via CLI so the DB isn't empty.
Usage:
  python -m tools.seed_templates
  python -m tools.seed_templates --reset   # update existing Standard prompt_text from file
"""

import argparse
from pathlib import Path

# Project root (parent of tools/)
PROJECT_ROOT = Path(__file__).resolve().parent.parent


def seed_templates(reset: bool = False) -> None:
    from backend.models import db, MeetingTemplate

    # Resolve path: try both Prompts and prompts (e.g. /meeting_intelligence/Prompts/standard.txt)
    standard_path = PROJECT_ROOT / "Prompts" / "standard.txt"
    if not standard_path.is_file():
        standard_path = PROJECT_ROOT / "prompts" / "standard.txt"
    if not standard_path.is_file():
        raise FileNotFoundError(f"Prompt file not found. Tried: {PROJECT_ROOT / 'Prompts' / 'standard.txt'} and {PROJECT_ROOT / 'prompts' / 'standard.txt'}")

    abs_path = standard_path.resolve()
    prompt_text = standard_path.read_text(encoding="utf-8").strip()
    print(f"[seed_templates] Reading from: {abs_path}")

    existing = MeetingTemplate.query.filter_by(name="Standard").first()
    if existing:
        if reset:
            existing.prompt_text = prompt_text
            db.session.commit()
        return

    print(f"Seeding template with content: {prompt_text[:50]}...")
    template = MeetingTemplate(
        name="Standard",
        prompt_text=prompt_text,
        is_default=True,
    )
    db.session.add(template)
    db.session.commit()
    print(f"[seed_templates] Committed Standard template (id={template.id})")


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed meeting templates (e.g. Standard from Prompts/standard.txt)")
    parser.add_argument("--reset", action="store_true", help="Update existing Standard template with current file contents")
    args = parser.parse_args()

    from app import app

    with app.app_context():
        seed_templates(reset=args.reset)


if __name__ == "__main__":
    main()
