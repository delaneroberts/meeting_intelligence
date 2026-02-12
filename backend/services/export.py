"""
Export service for meeting artifacts (PDF, JSON, etc).

Handles PDF generation, meeting artifact storage, and export operations.
Phase 1: PDF export only
Phase 3: Add email export support
"""

import os
import re
import json
import logging
from datetime import datetime
from io import BytesIO

from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, ListFlowable, ListItem
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import inch

logger = logging.getLogger(__name__)

# Import config (will be set by app)
TRANSCRIPT_FOLDER = None
_MEETING_ID_RE = re.compile(r"^[A-Za-z0-9_-]{6,80}$")


def set_transcript_folder(folder_path: str):
    """Set the transcript folder path (called from app.py)."""
    global TRANSCRIPT_FOLDER
    TRANSCRIPT_FOLDER = folder_path
    os.makedirs(TRANSCRIPT_FOLDER, exist_ok=True)


def new_meeting_id() -> str:
    """Generate a unique meeting ID based on timestamp.
    
    Format: YYYYMMDD_HHMMSS_ms (e.g., 20260211_090124_978)
    """
    return datetime.now().strftime("%Y%m%d_%H%M%S_%f")[:-3]


def safe_meeting_id(meeting_id: str) -> str:
    """Validate meeting ID format for safety.
    
    Args:
        meeting_id: Meeting ID to validate
    
    Returns:
        The meeting ID if valid
        
    Raises:
        ValueError: If meeting ID is invalid
    """
    if not meeting_id or not _MEETING_ID_RE.match(meeting_id):
        raise ValueError("Invalid meeting_id")
    return meeting_id


def meeting_json_path(meeting_id: str) -> str:
    """Get the path to meeting JSON artifact file.
    
    Args:
        meeting_id: Meeting ID
    
    Returns:
        Full path to the meeting JSON file
    """
    meeting_id = safe_meeting_id(meeting_id)
    return os.path.join(TRANSCRIPT_FOLDER, f"{meeting_id}.json")


def save_meeting_artifacts(
    meeting_id: str,
    filename: str,
    transcript: str,
    summary: str,
    action_items: list,
    original_language: str = "English",
    was_translated: bool = False,
    memo_json: dict = None
) -> None:
    """Save meeting data as JSON artifact.
    
    Args:
        meeting_id: Unique meeting ID
        filename: Original audio filename
        transcript: Full transcript text
        summary: Generated summary
        action_items: List of action items
        original_language: Detected language
        was_translated: Whether translation occurred
        memo_json: Optional structured memo data
    """
    payload = {
        "meeting_id": meeting_id,
        "created_at": datetime.now().isoformat(timespec="seconds"),
        "source_filename": filename,
        "original_language": original_language,
        "was_translated": was_translated,
        "transcript": transcript or "",
        "summary": summary or "",
        "action_items": action_items or [],
        "memo_json": memo_json or {},
    }
    
    path = meeting_json_path(meeting_id)
    try:
        with open(path, "w", encoding="utf-8") as f:
            json.dump(payload, f, ensure_ascii=False, indent=2)
        logger.info("Saved meeting artifacts to: %s", os.path.abspath(path))
    except Exception as e:
        logger.exception("Error saving meeting artifacts: %s", e)
        raise


def load_meeting_artifacts(meeting_id: str) -> dict:
    """Load meeting data from JSON artifact.
    
    Args:
        meeting_id: Meeting ID
    
    Returns:
        Dictionary with meeting data
        
    Raises:
        FileNotFoundError: If artifact doesn't exist
        json.JSONDecodeError: If JSON is invalid
    """
    path = meeting_json_path(meeting_id)
    if not os.path.exists(path):
        logger.warning("Meeting artifact not found: %s", path)
        raise FileNotFoundError(path)
    
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        logger.info("Loaded meeting artifacts from: %s", path)
        return data
    except json.JSONDecodeError as e:
        logger.exception("Error parsing meeting JSON: %s", e)
        raise
    except Exception as e:
        logger.exception("Error reading meeting artifacts: %s", e)
        raise


def delete_meeting_artifacts(meeting_id: str) -> None:
    """Delete meeting JSON artifact.
    
    Args:
        meeting_id: Meeting ID
    """
    path = meeting_json_path(meeting_id)
    try:
        if os.path.exists(path):
            os.remove(path)
            logger.info("Deleted meeting artifacts: %s", path)
    except Exception as e:
        logger.warning("Error deleting meeting artifacts: %s", e)


def build_pdf_bytes(data: dict) -> bytes:
    """Generate PDF report from meeting data.
    
    Args:
        data: Meeting data dictionary with keys like 'meeting_id', 'summary', etc
    
    Returns:
        PDF content as bytes
    """
    buf = BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=letter,
        leftMargin=0.8 * inch,
        rightMargin=0.8 * inch,
        topMargin=0.8 * inch,
        bottomMargin=0.8 * inch,
    )
    styles = getSampleStyleSheet()

    story = []
    
    # Title
    story.append(Paragraph("Meeting Assistant Report", styles["Title"]))
    story.append(Spacer(1, 12))

    # Metadata
    story.append(Paragraph(f"Meeting ID: {data.get('meeting_id','')}", styles["Normal"]))
    story.append(Paragraph(f"Created: {data.get('created_at','')}", styles["Normal"]))
    
    src = data.get("source_filename") or ""
    if src:
        story.append(Paragraph(f"Source file: {src}", styles["Normal"]))
    
    original_language = data.get("original_language")
    if original_language and original_language.lower() != "english":
        story.append(Paragraph(f"Original language: {original_language}", styles["Normal"]))
    
    story.append(Spacer(1, 12))

    # Summary section
    story.append(Paragraph("Summary", styles["Heading2"]))
    summary_text = (data.get("summary") or "").replace("\n", "<br/>")
    if summary_text:
        story.append(Paragraph(summary_text, styles["BodyText"]))
    else:
        story.append(Paragraph("No summary available.", styles["BodyText"]))
    story.append(Spacer(1, 12))

    # Action Items section
    story.append(Paragraph("Action Items", styles["Heading2"]))
    items = data.get("action_items") or []
    if items:
        story.append(
            ListFlowable(
                [ListItem(Paragraph(str(x), styles["BodyText"])) for x in items],
                bulletType="1",
            )
        )
    else:
        story.append(Paragraph("No action items found.", styles["BodyText"]))
    story.append(Spacer(1, 12))

    # Transcript section
    story.append(Paragraph("Transcript", styles["Heading2"]))
    transcript_text = (data.get("transcript") or "").replace("\n", "<br/>")
    if transcript_text:
        story.append(Paragraph(transcript_text, styles["BodyText"]))
    else:
        story.append(Paragraph("No transcript available.", styles["BodyText"]))

    # Build PDF
    doc.build(story)
    return buf.getvalue()


def export_to_pdf(meeting_id: str) -> bytes:
    """Generate PDF for a meeting by ID.
    
    Args:
        meeting_id: Meeting ID
    
    Returns:
        PDF content as bytes
        
    Raises:
        FileNotFoundError: If meeting doesn't exist
    """
    data = load_meeting_artifacts(meeting_id)
    return build_pdf_bytes(data)
