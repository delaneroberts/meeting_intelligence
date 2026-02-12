import os
import time
import json
import logging
import subprocess
import re
from datetime import datetime
from io import BytesIO

from flask import Flask, render_template, request, jsonify, send_file, abort, url_for
from werkzeug.utils import secure_filename

from openai import OpenAI

from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, ListFlowable, ListItem
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import inch

# Import backend modules
from backend.routes.api import api as api_blueprint
from backend.services import transcription, translation, summarization, qa_detection, export
from backend.config import (
    UPLOAD_FOLDER as CONFIG_UPLOAD_FOLDER,
    TRANSCRIPT_FOLDER as CONFIG_TRANSCRIPT_FOLDER,
    FLASK_PORT,
    SQLALCHEMY_DATABASE_URI,
    SQLALCHEMY_TRACK_MODIFICATIONS,
)
from backend.models import db


# ----------------------------
# Config / Folders
# ----------------------------
UPLOAD_FOLDER = CONFIG_UPLOAD_FOLDER
TRANSCRIPT_FOLDER = CONFIG_TRANSCRIPT_FOLDER
LOG_FOLDER = "logs"

MAX_FILE_AGE_SECONDS = 60 * 60  # 1 hour
MAX_CONTENT_LENGTH = 25 * 1024 * 1024  # 25 MB

os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(TRANSCRIPT_FOLDER, exist_ok=True)
os.makedirs(LOG_FOLDER, exist_ok=True)

# Initialize export service
export.set_transcript_folder(TRANSCRIPT_FOLDER)


# ----------------------------
# Logging
# ----------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler(os.path.join(LOG_FOLDER, "app.log"), encoding="utf-8"),
    ],
)
logger = logging.getLogger(__name__)

# ----------------------------
# Flask + OpenAI client
# ----------------------------
app = Flask(__name__)
app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER
app.config["MAX_CONTENT_LENGTH"] = MAX_CONTENT_LENGTH
app.config["SQLALCHEMY_DATABASE_URI"] = SQLALCHEMY_DATABASE_URI
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = SQLALCHEMY_TRACK_MODIFICATIONS

db.init_app(app)

# Register backend API blueprint
app.register_blueprint(api_blueprint)

client = OpenAI()  # reads OPENAI_API_KEY from environment


# ----------------------------
# Housekeeping
# ----------------------------
def cleanup_old_files() -> None:
    """Delete old audio + transcript files."""
    now = time.time()
    for folder in (UPLOAD_FOLDER, TRANSCRIPT_FOLDER):
        if not os.path.isdir(folder):
            continue
        for name in os.listdir(folder):
            path = os.path.join(folder, name)
            try:
                if os.path.isfile(path):
                    age = now - os.path.getmtime(path)
                    if age > MAX_FILE_AGE_SECONDS:
                        os.remove(path)
                        logger.info("Deleted old file: %s", path)
            except Exception as e:
                logger.warning("Cleanup error on %s: %s", path, e)


# ----------------------------
# Transcription (delegated to backend service)
# ----------------------------
def transcribe_audio_file(file_path: str) -> tuple[str, str]:
    """
    Use OpenAI Whisper to transcribe audio to text.
    
    Delegates to backend.services.transcription
    
    Returns:
        (transcript_text, detected_language)
    """
    return transcription.transcribe_audio_file(file_path)


# ----------------------------
# Language Detection & Translation (delegated to backend service)
# ----------------------------
def detect_and_translate_if_needed(text: str, source_language: str = "") -> tuple[str, str, bool]:
    """
    Detect the language of the text and translate to English if needed.
    
    Delegates to backend.services.translation
    
    Returns:
        (translated_text, language_name, was_translated)
    """
    return translation.detect_and_translate_if_needed(text, source_language)


# ----------------------------
# Summarization (delegated to backend service)
# ----------------------------
def _render_memo_to_text(data: dict) -> str:
    """Convert structured memo JSON to readable text."""
    # This is kept for backward compatibility, but the real work
    # is done in backend.services.summarization._render_memo_to_text
    from backend.services.summarization import _render_memo_to_text as render_func
    return render_func(data)


def summarize_and_extract_actions(transcript: str, agenda: str = "", detected_language: str = "English"):
    """
    Returns:
      summary: str
      action_items: list[str]
      memo_json: dict

    Delegates to backend.services.summarization
    """
    return summarization.summarize_and_extract_actions(transcript, agenda, detected_language)


# ----------------------------
# Meeting artifact storage (delegated to backend service)
# ----------------------------
def new_meeting_id() -> str:
    """Generate a unique meeting ID based on timestamp."""
    return export.new_meeting_id()


def safe_meeting_id(meeting_id: str) -> str:
    """Validate meeting ID format for safety."""
    return export.safe_meeting_id(meeting_id)


def meeting_json_path(meeting_id: str) -> str:
    """Get the path to meeting JSON artifact file."""
    return export.meeting_json_path(meeting_id)


def save_meeting_artifacts(meeting_id: str, filename: str, transcript: str, summary: str, action_items: list, original_language: str = "English", was_translated: bool = False) -> None:
    """Save meeting data as JSON artifact."""
    return export.save_meeting_artifacts(
        meeting_id=meeting_id,
        filename=filename,
        transcript=transcript,
        summary=summary,
        action_items=action_items,
        original_language=original_language,
        was_translated=was_translated,
    )


def load_meeting_artifacts(meeting_id: str) -> dict:
    """Load meeting data from JSON artifact."""
    return export.load_meeting_artifacts(meeting_id)


def delete_meeting_artifacts(meeting_id: str) -> None:
    """Delete meeting JSON artifact."""
    return export.delete_meeting_artifacts(meeting_id)


# ----------------------------
# PDF generation (delegated to backend service)
# ----------------------------
def build_pdf_bytes(data: dict) -> bytes:
    """Generate PDF report from meeting data."""
    return export.build_pdf_bytes(data)


# ----------------------------
# Routes
# ----------------------------
@app.errorhandler(413)
def file_too_large(e):
    return jsonify({"error": "File is too large. Limit is 25 MB."}), 413


@app.route("/", methods=["GET"])
def index():
    return render_template("index.html")


@app.route("/process", methods=["POST"])
def process():
    cleanup_old_files()

    if "audio_file" not in request.files:
        return jsonify({"error": "No file part in request."}), 400

    file = request.files["audio_file"]
    if file.filename == "":
        return jsonify({"error": "No file selected."}), 400

    filename = secure_filename(file.filename)
    save_path = os.path.join(app.config["UPLOAD_FOLDER"], filename)
    file.save(save_path)
    logger.info("Saved file to: %s", os.path.abspath(save_path))

    # Get agenda from request if present
    agenda = request.form.get("agenda", "").strip()

    # Transcribe
    try:
        transcript_text, source_language = transcribe_audio_file(save_path)
    except Exception as e:
        logger.exception("Error processing the audio file")
        return jsonify({"error": f"Error processing the audio file: {e}"}), 500

    # Store the original (untranslated) transcript
    original_transcript = transcript_text

    # Detect language and translate if needed
    translated_transcript, detected_language, was_translated = detect_and_translate_if_needed(transcript_text, source_language)
    
    if was_translated:
        logger.info("Transcript translated from %s to English", detected_language)

    # Save original transcript as .txt
    base, _ = os.path.splitext(filename)
    transcript_filename = f"{base}.txt"
    transcript_path = os.path.join(TRANSCRIPT_FOLDER, transcript_filename)
    try:
        with open(transcript_path, "w", encoding="utf-8") as f:
            # Save the translated version in the transcript file
            f.write(translated_transcript)
        logger.info("Saved transcript to: %s", os.path.abspath(transcript_path))
    except Exception:
        logger.exception("Error saving transcript")
        transcript_filename = ""

    # Summarize (with agenda if provided, using English/translated transcript for better accuracy)
    try:
        summary, action_items, memo_json = summarize_and_extract_actions(translated_transcript, agenda, detected_language)
    except Exception:
        logger.exception("Error summarizing transcript")
        summary, action_items = "", []

    # Generate original language version if not English
    original_summary = summary
    original_action_items = action_items
    if was_translated and detected_language and detected_language.lower() != "english":
        try:
            translate_prompt = f"""Translate this meeting summary to {detected_language}. Keep the structure and meaning intact. Only provide the translated text.

Summary:
{summary}"""
            translate_response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[{"role": "user", "content": translate_prompt}],
                max_tokens=2048,
            )
            original_summary = translate_response.choices[0].message.content.strip()
            logger.info("Translated summary to %s", detected_language)
        except Exception as e:
            logger.warning("Could not translate summary to %s: %s", detected_language, e)
            original_summary = summary  # Fallback to English
        
        # Translate action items
        try:
            action_items_text = "\n".join(action_items)
            action_items_prompt = f"""Translate these action items to {detected_language}. Keep the structure and meaning intact. Return as a numbered list.

Action Items:
{action_items_text}"""
            action_items_response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[{"role": "user", "content": action_items_prompt}],
                max_tokens=1024,
            )
            translated_items_text = action_items_response.choices[0].message.content.strip()
            # Parse the translated items back into a list
            original_action_items = [item.strip() for item in translated_items_text.split('\n') if item.strip()]
            logger.info("Translated action items to %s", detected_language)
        except Exception as e:
            logger.warning("Could not translate action items to %s: %s", detected_language, e)
            original_action_items = action_items  # Fallback to English

    # Save canonical meeting artifact JSON
    meeting_id = new_meeting_id()
    # Save the raw memo JSON (for debugging / inspection)
    try:
        memo_path = os.path.join(TRANSCRIPT_FOLDER, f"{meeting_id}_memo.json")
        with open(memo_path, "w", encoding="utf-8") as f:
            json.dump(memo_json, f, ensure_ascii=False, indent=2)
        logger.info("Saved memo JSON to: %s", os.path.abspath(memo_path))
    except Exception:
        logger.exception("Error saving memo JSON")
    try:
        save_meeting_artifacts(
            meeting_id=meeting_id,
            filename=filename,
            transcript=translated_transcript,
            summary=summary,
            action_items=action_items,
            original_language=detected_language,
            was_translated=was_translated,
        )
        logger.info("Saved meeting artifacts JSON: %s", os.path.abspath(meeting_json_path(meeting_id)))
    except Exception:
        logger.exception("Error saving meeting artifacts JSON")

    # Optionally delete the audio file after processing
    try:
        os.remove(save_path)
        logger.info("Deleted audio file: %s", save_path)
    except Exception as e:
        logger.warning("Could not delete audio file %s: %s", save_path, e)

    return jsonify(
        {
            "meeting_id": meeting_id,
            "transcript": original_transcript,
            "english_transcript": translated_transcript,
            "summary": original_summary,
            "english_summary": summary,
            "action_items": original_action_items,
            "english_action_items": action_items,
            "transcript_file": transcript_filename,
            "original_language": detected_language,
            "was_translated": was_translated,
            "download_url": url_for("download_pdf", meeting_id=meeting_id),
            "discard_url": url_for("discard_meeting", meeting_id=meeting_id),
            "memo_json": memo_json,
        }
    )


@app.route("/download/<meeting_id>", methods=["GET"])
def download_pdf(meeting_id):
    try:
        data = load_meeting_artifacts(meeting_id)
    except (ValueError, FileNotFoundError):
        abort(404)

    pdf_bytes = build_pdf_bytes(data)
    filename = f"{meeting_id}_meeting_report.pdf"

    return send_file(
        BytesIO(pdf_bytes),
        mimetype="application/pdf",
        as_attachment=True,
        download_name=filename,
    )


@app.route("/discard/<meeting_id>", methods=["POST"])
def discard_meeting(meeting_id):
    try:
        safe_meeting_id(meeting_id)
        delete_meeting_artifacts(meeting_id)
    except ValueError:
        abort(400)
    return jsonify({"status": "discarded", "meeting_id": meeting_id})


@app.route("/open_transcripts", methods=["POST"])
def open_transcripts():
    """On macOS, open the transcripts folder in Finder."""
    folder = os.path.abspath(TRANSCRIPT_FOLDER)
    try:
        subprocess.run(["open", folder], check=True)
        return jsonify({"status": "ok"})
    except Exception as e:
        logger.warning("Could not open transcripts folder: %s", e)
        return jsonify({"error": "Could not open transcripts folder."}), 500


@app.route("/detect_questions", methods=["POST"])
def detect_questions():
    """
    Detect questions in new transcript and answer them automatically.
    """
    try:
        data = request.get_json()
        new_transcript = (data.get("new_transcript") or "").strip()
        full_transcript = (data.get("full_transcript") or "").strip()

        if not new_transcript or len(new_transcript) < 20:
            return jsonify({"questions": []})

        logger.info("Detecting questions in %d char transcript snippet", len(new_transcript))

        # Use GPT to detect questions and determine if rhetorical
        detection_prompt = f"""Analyze this transcript snippet and identify any questions asked.

For each question found:
1. Extract the exact question (verbatim from the transcript)
2. Determine if it's a rhetorical question (asked for effect, not expecting answer) or a real question
3. If it's a real question, answer it based on the FULL meeting transcript so far

Respond with ONLY a JSON array (no other text):
[
  {{
    "question": "What was the deadline mentioned?",
    "is_rhetorical": false,
    "answer": "The deadline is March 15, 2026."
  }},
  {{
    "question": "Isn't that amazing?",
    "is_rhetorical": true,
    "answer": "This is marked as rhetorical and doesn't need an answer."
  }}
]

If no questions are found, return an empty array: []

New transcript snippet:
\"\"\"{new_transcript}\"\"\"

Full transcript context:
\"\"\"{full_transcript}\"\"\"
"""

        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "user", "content": detection_prompt}
            ],
            temperature=0.5,
            max_tokens=1000,
        )

        response_text = (response.choices[0].message.content or "").strip()
        
        try:
            questions = json.loads(response_text)
            if not isinstance(questions, list):
                questions = []
        except json.JSONDecodeError:
            logger.warning("Failed to parse question detection response: %s", response_text)
            questions = []

        logger.info("Detected %d questions", len(questions))

        return jsonify({
            "questions": questions
        })

    except Exception as e:
        logger.exception("Question detection error: %s", e)
        return jsonify({"questions": [], "error": str(e)}), 500


@app.route("/translate_content", methods=["POST"])
def translate_content():
    """Endpoint to translate summary and transcript to target language"""
    data = request.json
    summary = data.get("summary", "")
    transcript = data.get("transcript", "")
    target_language = data.get("target_language", "English")
    
    if not summary or not transcript:
        return jsonify({"error": "Summary and transcript are required"}), 400
    
    try:
        # Translate summary
        summary_prompt = f"""Translate the following meeting summary to {target_language}. Keep the same structure and meaning. Only provide the translated text, nothing else.

Summary:
{summary}"""
        
        summary_response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": summary_prompt}],
            max_tokens=2048,
        )
        translated_summary = summary_response.choices[0].message.content.strip()
        
        # Translate transcript
        transcript_prompt = f"""Translate the following meeting transcript to {target_language}. Maintain the speaker labels and structure. Only provide the translated text, nothing else.

Transcript:
{transcript}"""
        
        transcript_response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": transcript_prompt}],
            max_tokens=4096,
        )
        translated_transcript = transcript_response.choices[0].message.content.strip()
        
        return jsonify({
            "translated_summary": translated_summary,
            "translated_transcript": translated_transcript,
        })
    
    except Exception as e:
        logger.exception("Translation error: %s", e)
        return jsonify({"error": str(e)}), 500


# ----------------------------
# Main
# ----------------------------
if __name__ == "__main__":
    if not os.environ.get("OPENAI_API_KEY"):
        logger.warning("WARNING: OPENAI_API_KEY is not set in the environment.")
    # Allow connections from local network (iPhone/iPad on same WiFi)
    # Port can be overridden with FLASK_PORT environment variable
    # Example: export FLASK_PORT=8001 && python app.py
    port = int(os.getenv("FLASK_PORT", 8001))
    # Disable the reloader so uploads don't trigger a restart mid-request
    app.run(host="0.0.0.0", port=port, debug=True, use_reloader=False)
