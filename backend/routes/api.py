"""
API routes for Meeting Assistant.

Phase 1 endpoints:
- POST /api/process - Process audio file
- GET /api/process/status/<job_id> - Long-polling status for async processing
- POST /api/detect_questions - Detect Q&A in transcript
- POST /api/translate_content - Translate content to target language
- GET /api/download/<meeting_id> - Download PDF
- POST /api/discard/<meeting_id> - Delete meeting
- POST /api/open_transcripts - Open transcripts folder
"""

import logging
import os
import subprocess
import threading
from flask import Blueprint, request, jsonify, send_file, abort, url_for, current_app
from werkzeug.utils import secure_filename
from io import BytesIO

from ..services import transcription, translation, summarization, qa_detection, export
from ..services.openai_wrapper import OpenAIError, OpenAITimeoutError
from ..models import Setting
from ..config import UPLOAD_FOLDER, TRANSCRIPT_FOLDER, LOG_FOLDER

logger = logging.getLogger(__name__)

# In-memory job progress for long-polling (job_id -> { status, progress, message, result?, error? })
JOB_PROGRESS = {}

# Create blueprint
api = Blueprint('api', __name__, url_prefix='/api')


@api.before_request
def before_request():
    """Initialize services for each request."""
    # Ensure export service knows about transcript folder
    if not export.TRANSCRIPT_FOLDER:
        export.set_transcript_folder(TRANSCRIPT_FOLDER)


@api.route('/health', methods=['GET'])
def health():
    """Health check endpoint."""
    return jsonify({"status": "ok"}), 200


@api.route('/process/status/<job_id>', methods=['GET'])
def process_status(job_id):
    """Long-polling: return current progress for an async process job."""
    data = JOB_PROGRESS.get(job_id)
    if data is None:
        return jsonify({"status": "not_found", "progress": 0, "message": "Unknown job."}), 404
    if data.get("status") == "completed" and data.get("result"):
        result = data["result"]
        result["download_url"] = url_for("api.download_pdf", meeting_id=result["meeting_id"])
        result["discard_url"] = url_for("api.discard_meeting", meeting_id=result["meeting_id"])
    return jsonify(data), 200


def _run_process_job(job_id: str, save_path: str, filename: str, agenda: str, user_id: int, app) -> None:
    """Run the full transcribe/translate/summarize pipeline and update JOB_PROGRESS.
    Must run inside Flask app context for DB and config (summarization uses User/db).
    """
    def set_progress(status: str, progress: float, message: str, **extra):
        JOB_PROGRESS[job_id] = {**JOB_PROGRESS.get(job_id, {}), "status": status, "progress": progress, "message": message, **extra}

    with app.app_context():
        _run_process_job_impl(job_id, save_path, filename, agenda, user_id, set_progress)


def _run_process_job_impl(job_id: str, save_path: str, filename: str, agenda: str, user_id: int, set_progress) -> None:
    try:
        set_progress("transcribing", 0.1, "Transcribing…")
        transcribe_result = transcription.transcribe_audio_file(save_path)
        if transcribe_result is None:
            set_progress("error", 0, "Transcription returned no result.", error="Transcription returned no result.")
            return
        transcript_text, source_language = transcribe_result
        original_transcript = transcript_text

        set_progress("translating", 0.35, "Translating…")
        translate_result = translation.detect_and_translate_if_needed(transcript_text, source_language)
        if translate_result is None:
            set_progress("error", 0, "Translation returned no result.", error="Translation returned no result.")
            return
        translated_transcript, detected_language, was_translated = translate_result

        set_progress("summarizing", 0.6, "Generating summary…")
        summary_result = summarization.summarize_and_extract_actions(
            translated_transcript, agenda, detected_language, user_id=user_id
        )
        if summary_result is None:
            set_progress("error", 0, "Summarization returned no result.", error="Summarization returned no result.")
            return
        summary, action_items, memo_json = summary_result
        original_summary = summary
        original_action_items = action_items
        if was_translated and detected_language and detected_language.lower() != "english":
            back_result = _translate_results_back(summary, action_items, detected_language)
            if back_result is not None:
                original_summary, original_action_items = back_result

        set_progress("saving", 0.9, "Saving…")
        meeting_id = export.new_meeting_id()
        export.save_meeting_artifacts(
            meeting_id=meeting_id,
            filename=filename,
            transcript=translated_transcript,
            summary=summary,
            action_items=action_items,
            original_language=detected_language,
            was_translated=was_translated,
            memo_json=memo_json,
        )
        try:
            os.remove(save_path)
        except Exception as e:
            logger.warning("Could not delete audio file: %s", e)

        result = {
            "meeting_id": meeting_id,
            "transcript": original_transcript,
            "english_transcript": translated_transcript,
            "summary": original_summary,
            "english_summary": summary,
            "action_items": original_action_items,
            "english_action_items": action_items,
            "original_language": detected_language,
            "was_translated": was_translated,
            "memo_json": memo_json,
        }
        set_progress("completed", 1.0, "Done", result=result)
    except (OpenAITimeoutError, OpenAIError) as e:
        logger.exception("Job %s upstream error: %s", job_id, e)
        set_progress("error", 0, str(e) or "Upstream API error.", error=str(e))
    except TypeError as e:
        if "unpack" in str(e).lower() or "non-iterable" in str(e).lower():
            logger.exception("Job %s: unexpected None or wrong shape from a step: %s", job_id, e)
            set_progress("error", 0, "A processing step returned an invalid result. Try again.", error=str(e))
        else:
            raise
    except Exception as e:
        logger.exception("Job %s failed: %s", job_id, e)
        set_progress("error", 0, str(e) or "Processing failed.", error=str(e))


@api.route('/process', methods=['POST'])
def process_audio():
    """
    Process audio file: transcribe, translate, summarize.
    
    Form data:
    - audio_file: Audio file upload
    - agenda: Optional meeting agenda
    
    Returns:
    - meeting_id: Unique ID for this meeting
    - transcript: Original language transcript
    - english_transcript: Translated to English (if needed)
    - summary: Original language summary
    - english_summary: English summary
    - action_items: Original language action items
    - english_action_items: English action items
    - was_translated: Whether translation occurred
    - original_language: Detected language
    - download_url: URL to download PDF
    - discard_url: URL to delete meeting
    - memo_json: Structured meeting data
    """
    try:
        logger.info("[process] Request received (audio_file present)")
        # Cleanup old files
        _cleanup_old_files()

        # Validate file
        if "audio_file" not in request.files:
            return jsonify({"error": "No file part in request."}), 400

        file = request.files["audio_file"]
        if file.filename == "":
            return jsonify({"error": "No file selected."}), 400

        # Save uploaded file
        filename = secure_filename(file.filename)
        save_path = os.path.join(UPLOAD_FOLDER, filename)
        file.save(save_path)
        logger.info("Saved audio file: %s", os.path.abspath(save_path))

        # Get optional agenda and progress_job_id from request
        agenda = request.form.get("agenda", "").strip()
        job_id = request.form.get("progress_job_id", "").strip()
        user_id = 1
        if "user_id" in request.form:
            try:
                user_id = int(request.form["user_id"])
            except (TypeError, ValueError):
                pass

        # Async path: run in background and return 202 for long-polling progress
        if job_id:
            JOB_PROGRESS[job_id] = {"status": "processing", "progress": 0.05, "message": "Starting…"}
            app = current_app._get_current_object()
            thread = threading.Thread(
                target=_run_process_job,
                args=(job_id, save_path, filename, agenda, user_id, app),
                daemon=True,
            )
            thread.start()
            return jsonify({
                "job_id": job_id,
                "status": "processing",
                "message": "Poll GET /api/process/status/<job_id> for progress.",
            }), 202

        # Step 1: Transcribe (sync path)
        try:
            transcript_text, source_language = transcription.transcribe_audio_file(save_path)
        except OpenAITimeoutError as e:
            logger.exception("Transcription timed out: %s", e)
            return jsonify({"error": "Transcription timed out. Try a shorter recording or try again."}), 502
        except OpenAIError as e:
            logger.exception("Upstream API error during transcription: %s", e)
            return jsonify({"error": "Upstream API error during transcription."}), 502
        except Exception as e:
            logger.exception("Transcription failed")
            return jsonify({"error": f"Transcription failed: {e}"}), 500

        original_transcript = transcript_text

        # Step 2: Detect language and translate if needed
        logger.info("[process] Step 2: Starting language detection / translation...")
        try:
            translated_transcript, detected_language, was_translated = (
                translation.detect_and_translate_if_needed(transcript_text, source_language)
            )
            logger.info("[process] Step 2: Language / translation done.")
        except (OpenAITimeoutError, OpenAIError) as e:
            logger.exception("Upstream API error during translation/detection: %s", e)
            return jsonify({"error": "Upstream API error during translation/detection."}), 502
        

        if was_translated:
            logger.info("Transcript translated from %s to English", detected_language)

        # Step 3: Summarize and extract action items
        logger.info("[process] Step 3: Starting summarization...")
        try:
            # Get user_id from request if provided, else default to 1
            user_id = 1
            if "user_id" in request.form:
                try:
                    user_id = int(request.form["user_id"])
                except Exception:
                    logger.warning("Invalid user_id in form, defaulting to 1")
            summary, action_items, memo_json = (
                summarization.summarize_and_extract_actions(
                    translated_transcript, agenda, detected_language, user_id=user_id
                )
            )
            logger.info("[process] Step 3: Summarization done.")
        except Exception as e:
            logger.exception("Summarization failed")
            summary, action_items, memo_json = "", [], {}

        # Step 4: Generate original language versions if translated
        original_summary = summary
        original_action_items = action_items
        
        if was_translated and detected_language and detected_language.lower() != "english":
            original_summary, original_action_items = _translate_results_back(
                summary, action_items, detected_language
            )

        # Step 5: Save meeting artifacts
        logger.info("[process] Step 5: Saving meeting artifacts...")
        meeting_id = export.new_meeting_id()
        
        try:
            export.save_meeting_artifacts(
                meeting_id=meeting_id,
                filename=filename,
                transcript=translated_transcript,
                summary=summary,
                action_items=action_items,
                original_language=detected_language,
                was_translated=was_translated,
                memo_json=memo_json,
            )
        except Exception as e:
            logger.exception("Failed to save meeting artifacts")
            return jsonify({"error": f"Failed to save meeting: {e}"}), 500
        logger.info("[process] Step 5: Artifacts saved. meeting_id=%s", meeting_id)

        # Step 6: Cleanup audio file
        try:
            os.remove(save_path)
            logger.info("Deleted audio file: %s", save_path)
        except Exception as e:
            logger.warning("Could not delete audio file: %s", e)

        return jsonify({
            "meeting_id": meeting_id,
            "transcript": original_transcript,
            "english_transcript": translated_transcript,
            "summary": original_summary,
            "english_summary": summary,
            "action_items": original_action_items,
            "english_action_items": action_items,
            "original_language": detected_language,
            "was_translated": was_translated,
            "download_url": url_for("api.download_pdf", meeting_id=meeting_id),
            "discard_url": url_for("api.discard_meeting", meeting_id=meeting_id),
            "memo_json": memo_json,
        })

    except Exception as e:
        logger.exception("Unexpected error in process_audio")
        return jsonify({"error": f"Unexpected error: {e}"}), 500


@api.route('/download/<meeting_id>', methods=['GET'])
def download_pdf(meeting_id):
    """Download PDF report for a meeting."""
    try:
        data = export.load_meeting_artifacts(meeting_id)
    except (ValueError, FileNotFoundError):
        logger.warning("Meeting not found: %s", meeting_id)
        abort(404)

    try:
        pdf_bytes = export.build_pdf_bytes(data)
        filename = f"{meeting_id}_meeting_report.pdf"

        return send_file(
            BytesIO(pdf_bytes),
            mimetype="application/pdf",
            as_attachment=True,
            download_name=filename,
        )
    except Exception as e:
        logger.exception("Error generating PDF: %s", e)
        abort(500)


@api.route('/discard/<meeting_id>', methods=['POST'])
def discard_meeting(meeting_id):
    """Delete a meeting and its artifacts."""
    try:
        export.safe_meeting_id(meeting_id)
        export.delete_meeting_artifacts(meeting_id)
    except ValueError:
        logger.warning("Invalid meeting ID: %s", meeting_id)
        abort(400)
    except Exception as e:
        logger.exception("Error discarding meeting: %s", e)
        abort(500)

    return jsonify({"status": "discarded", "meeting_id": meeting_id})


@api.route('/detect_questions', methods=['POST'])
def detect_questions():
    """
    Detect questions in a transcript snippet and answer them.
    
    JSON body:
    - new_transcript: New transcript snippet to analyze
    - full_transcript: Full meeting transcript for context
    
    Returns:
    - questions: List of detected questions with answers
    """
    try:
        data = request.get_json() or {}
        new_transcript = (data.get("new_transcript") or "").strip()
        full_transcript = (data.get("full_transcript") or "").strip()

        if not new_transcript or len(new_transcript) < 20:
            logger.debug("Transcript too short for question detection")
            return jsonify({"questions": []})

        questions = qa_detection.detect_and_answer_questions(
            new_transcript, full_transcript
        )

        return jsonify({"questions": questions})

    except Exception as e:
        logger.exception("Question detection error: %s", e)
        return jsonify({"questions": [], "error": str(e)}), 500


@api.route('/settings', methods=['GET', 'PUT'])
def settings():
    """Get or update settings for the default user (Phase 1)."""
    user_id = 1

    if request.method == 'GET':
        keys = ["default_language", "summary_language", "auto_detect_qa"]
        settings_map = {key: Setting.get(key, user_id=user_id) for key in keys}
        return jsonify({"settings": settings_map})

    payload = request.get_json(silent=True) or {}
    incoming = payload.get("settings") if isinstance(payload.get("settings"), dict) else payload

    if not isinstance(incoming, dict):
        return jsonify({"error": "Invalid settings payload."}), 400

    updated = {}
    for key, value in incoming.items():
        if isinstance(value, bool):
            data_type = "bool"
            stored_value = "true" if value else "false"
        elif isinstance(value, int):
            data_type = "int"
            stored_value = str(value)
        elif isinstance(value, (dict, list)):
            data_type = "json"
            stored_value = value
        else:
            data_type = "string"
            stored_value = str(value)

        Setting.set(key, stored_value, data_type=data_type, user_id=user_id)
        updated[key] = value

    return jsonify({"status": "ok", "settings": updated})


@api.route('/translate_content', methods=['POST'])
def translate_content():
    """
    Translate summary and transcript to a target language.
    
    JSON body:
    - summary: Summary text to translate
    - transcript: Transcript text to translate
    - target_language: Target language name (e.g., 'Spanish')
    
    Returns:
    - translated_summary: Translated summary
    - translated_transcript: Translated transcript
    """
    try:
        data = request.get_json() or {}
        summary = (data.get("summary") or "").strip()
        transcript = (data.get("transcript") or "").strip()
        target_language = (data.get("target_language") or "English").strip()

        if not summary or not transcript:
            return jsonify({"error": "summary and transcript are required"}), 400

        if target_language.lower() == "english":
            translated_summary = summary
            translated_transcript = transcript
        else:
            # Translate summary
            translated_summary = translation.translate_text(summary, target_language)

            # Translate transcript
            translated_transcript = translation.translate_text(transcript, target_language)

        return jsonify({
            "translated_summary": translated_summary,
            "translated_transcript": translated_transcript,
        })

    except Exception as e:
        logger.exception("Translation error: %s", e)
        return jsonify({"error": str(e)}), 500


@api.route('/open_transcripts', methods=['POST'])
def open_transcripts():
    """Open transcripts folder in system file browser (macOS only)."""
    folder = os.path.abspath(TRANSCRIPT_FOLDER)
    try:
        subprocess.run(["open", folder], check=True)
        return jsonify({"status": "ok"})
    except Exception as e:
        logger.warning("Could not open transcripts folder: %s", e)
        return jsonify({"error": "Could not open transcripts folder."}), 500


# ----------------------------
# Helper functions
# ----------------------------


def _cleanup_old_files():
    """Delete old audio and transcript files (older than 1 hour)."""
    import time
    from ..config import MAX_FILE_AGE_SECONDS

    now = time.time()
    for folder in (UPLOAD_FOLDER, TRANSCRIPT_FOLDER):
        if not os.path.isdir(folder):
            continue
        try:
            for name in os.listdir(folder):
                path = os.path.join(folder, name)
                try:
                    if os.path.isfile(path):
                        age = now - os.path.getmtime(path)
                        if age > MAX_FILE_AGE_SECONDS:
                            os.remove(path)
                            logger.info("Cleaned up old file: %s", path)
                except Exception as e:
                    logger.warning("Error cleaning up %s: %s", path, e)
        except Exception as e:
            logger.warning("Error listing folder %s: %s", folder, e)


def _translate_results_back(summary: str, action_items: list, target_language: str) -> tuple:
    """
    Translate summary and action items back to original language.
    
    Returns:
        Tuple of (translated_summary, translated_action_items)
    """
    if not target_language or target_language.lower() == "unknown":
        return summary, action_items

    try:
        translated_summary = translation.translate_text(summary, target_language)
    except Exception as e:
        logger.warning("Could not translate summary to %s: %s", target_language, e)
        translated_summary = summary


@api.route('/debug/log', methods=['POST'])
def debug_log():
    """Accept small JSON log payloads from client devices for debugging.

    Expected JSON body:
      {"level": "info"|"error"|"warn", "message": "text...", "meta": {...}}

    Appends a timestamped line to logs/client_debug.log and mirrors to logger.
    """
    try:
        payload = request.get_json(silent=True) or {}
        level = (payload.get('level') or 'info').upper()
        message = payload.get('message') or ''
        meta = payload.get('meta') or {}

        # Compose a one-line log entry
        from datetime import datetime
        ts = datetime.utcnow().isoformat() + 'Z'
        entry = f"{ts} [{level}] {message} | meta={meta}\n"

        # Ensure log folder exists (config should have created it already)
        try:
            client_log_path = os.path.join(LOG_FOLDER, 'client_debug.log')
            with open(client_log_path, 'a', encoding='utf-8') as fh:
                fh.write(entry)
        except Exception as e:
            logger.warning("Failed to write client debug log: %s", e)

        # Mirror to server logger for immediate visibility
        if level == 'ERROR' or level == 'ERR':
            logger.error("[client] %s -- meta=%s", message, meta)
        elif level == 'WARN' or level == 'WARNING':
            logger.warning("[client] %s -- meta=%s", message, meta)
        else:
            logger.info("[client] %s -- meta=%s", message, meta)

        return jsonify({"status": "ok"}), 200
    except Exception as e:
        logger.exception("Error handling client debug log: %s", e)
        return jsonify({"error": "internal"}), 500

    try:
        action_items_text = "\n".join(action_items)
        translated_items = translation.translate_text(action_items_text, target_language)
        translated_action_items = [
            item.strip() for item in translated_items.split('\n') if item.strip()
        ]
    except Exception as e:
        logger.warning("Could not translate action items to %s: %s", target_language, e)
        translated_action_items = action_items

    return translated_summary, translated_action_items
