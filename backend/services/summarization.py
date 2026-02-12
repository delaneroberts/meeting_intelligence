"""
Meeting summarization and action item extraction service.

Uses GPT-4o-mini to summarize transcripts and extract structured action items.
Supports structured JSON output with fallback to plain text.
"""

import json
import logging
from openai import OpenAI

logger = logging.getLogger(__name__)

# Initialize OpenAI client
client = OpenAI()  # reads OPENAI_API_KEY from environment

# Supported meeting types
MEETING_TYPES = [
    'recruiting',
    'interview',
    'sales',
    'customer_discovery',
    'planning',
    'status_update',
    'standup',
    'technical_review',
    'support',
    '1on1',
    'other',
]


def _render_memo_to_text(data: dict) -> str:
    """
    Convert structured memo JSON into a readable, well-spaced summary
    suitable for on-screen reading and PDFs.
    
    Args:
        data: Dictionary with meeting memo structure
    
    Returns:
        Formatted text summary
    """
    title = (data.get("title") or "Meeting Notes").strip()
    mtype = (data.get("meeting_type") or "other").strip()

    lines: list[str] = []

    # Header
    lines.append(title)
    lines.append(f"Type: {mtype}")
    lines.append("")  # blank line

    def add_section(header: str, items: list[str]):
        """Add a section with items if not empty."""
        if not items:
            return
        lines.append(header)
        lines.append("")  # space after header
        for it in items:
            s = str(it).strip()
            if s:
                lines.append(f"- {s}")
        lines.append("")  # space after section

    # Core sections
    add_section("Summary", data.get("summary_bullets") or [])
    add_section("Key Topics", data.get("key_topics") or [])
    add_section("Decisions", data.get("decisions") or [])
    add_section("Risks / Blockers", data.get("risks_blockers") or [])
    add_section("Open Questions", data.get("open_questions") or [])

    # Detailed notes by section
    sections = data.get("notes_by_section") or []
    if sections:
        lines.append("Details")
        lines.append("")
        for sec in sections:
            if not isinstance(sec, dict):
                continue
            heading = (sec.get("heading") or "").strip()
            bullets = sec.get("bullets") or []

            if heading:
                lines.append(heading)
                lines.append("")

            for b in bullets:
                s = str(b).strip()
                if s:
                    lines.append(f"- {s}")

            lines.append("")  # space between detail subsections

    # Trim trailing whitespace
    while lines and lines[-1] == "":
        lines.pop()

    return "\n".join(lines)


def summarize_and_extract_actions(
    transcript: str,
    agenda: str = "",
    detected_language: str = "English"
) -> tuple[str, list[str], dict]:
    """
    Summarize a meeting transcript and extract action items.
    
    Strategy:
    - Use GPT to produce structured JSON memo (meeting-type aware)
    - If agenda provided, organize around agenda items
    - Render memo to readable text
    - Extract action items as list[str]
    - Fallback to plain text if JSON fails
    
    Args:
        transcript: Full meeting transcript
        agenda: Optional meeting agenda
        detected_language: Language of transcript
    
    Returns:
        Tuple of (summary_text, action_items_list, memo_json_dict)
        
        - summary_text: Formatted summary for display
        - action_items_list: List of action items as strings
        - memo_json_dict: Structured meeting data (may be empty on fallback)
    """
    logger.info(
        "Summarizing transcript (%d chars), agenda present: %s, language: %s",
        len(transcript or ""),
        bool(agenda.strip()),
        detected_language
    )

    agenda_instruction = ""
    if agenda.strip():
        agenda_instruction = f"""

IMPORTANT: The meeting had the following agenda:
{agenda}

When structuring your notes, organize them by agenda items. Any discussion that doesn't fit the agenda should be placed in sections labeled "Opening Conversation" or "Other".
In the notes_by_section, use the agenda items as headings where applicable."""

    prompt_text = f"""
You are an enterprise meeting assistant.

Step 1: Identify meeting type.
Choose ONE meeting_type from:
recruiting, interview, sales, customer_discovery, planning, status_update, standup, technical_review, support, 1on1, other

Step 2: Produce a structured meeting memo as JSON using EXACTLY this schema:

{{
  "meeting_type": "...",
  "title": "Short descriptive title (max 10 words)",
  "summary_bullets": ["3-8 bullets, high signal"],
  "key_topics": ["3-10 short topic phrases"],
  "decisions": [],
  "action_items": [
    {{"item":"Action", "owner":"Name/role or Unassigned", "due":"Date or Not stated"}}
  ],
  "risks_blockers": [],
  "open_questions": [],
  "notes_by_section": [
    {{"heading":"Section heading", "bullets":["Bullets..."]}}
  ]
}}

Rules:
- Use ONLY what is explicitly stated in the transcript. Do NOT infer.
- Preserve exact numbers and commitments verbatim (prices, dates, headcount, utilization, SLA, etc.).
- If something is not discussed, leave arrays empty ([]) rather than adding filler.
- Keep it concise and actionable.
- Action items should only include explicit commitments or clearly assigned next steps.{agenda_instruction}

Transcript:
\"\"\"{transcript}\"\"\"
""".strip()

    # --- Attempt structured JSON output ---
    try:
        logger.debug("Attempting structured JSON summarization")
        resp = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "You are precise and structured."},
                {"role": "user", "content": prompt_text},
            ],
            temperature=0.2,
            max_tokens=900,
            response_format={"type": "json_object"},
        )

        content = (resp.choices[0].message.content or "").strip()
        data = json.loads(content) if content else {}

        summary_text = _render_memo_to_text(data)

        # Normalize action items to list[str] for UI
        action_items_raw = data.get("action_items") or []
        action_items: list[str] = []
        
        for ai in action_items_raw:
            if isinstance(ai, str):
                s = ai.strip()
                if s:
                    action_items.append(s)
            elif isinstance(ai, dict):
                item = (ai.get("item") or "").strip()
                owner = (ai.get("owner") or "Unassigned").strip()
                due = (ai.get("due") or "Not stated").strip()
                if item:
                    action_items.append(f"{item} — {owner} (Due: {due})")

        logger.info("Structured summarization succeeded, %d action items extracted", len(action_items))
        return summary_text, action_items, data

    except json.JSONDecodeError as e:
        logger.warning("JSON parsing failed in structured summarization: %s", e)
    except Exception as e:
        logger.warning("Structured summarization failed (will use fallback): %s", e)

    # --- Fallback: plain text (always works) ---
    logger.debug("Using fallback plain text summarization")
    fallback_prompt = f"""
Summarize the transcript in 5-10 bullet points (high signal, no fluff).
Then list action items as '-' bullets in the format: "Action — Owner (Due: ...)".
If none, write: None.

Transcript:
\"\"\"{transcript}\"\"\"
""".strip()

    try:
        resp = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": fallback_prompt}],
            temperature=0.2,
            max_tokens=900,
        )
        text = (resp.choices[0].message.content or "").strip()
        
        # Extract action items (lines starting with "- ")
        action_items = [
            ln[2:].strip() for ln in text.splitlines()
            if ln.strip().startswith("- ")
        ]
        
        logger.info("Fallback summarization succeeded, %d action items extracted", len(action_items))
        return text, action_items, {}
        
    except Exception as e:
        logger.exception("Fallback summarization also failed: %s", e)
        return "", [], {}
