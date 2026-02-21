"""
API routes for Meeting Assistant.

Routes are thin: validate input, call services, return JSON.
All routes use try/except and return consistent {"error": "..."} on failure.

Endpoints:
- GET  /api/health
- POST /api/process (async: 202 + job_id; sync: 200 + result)
- GET  /api/process/status/<job_id>
- GET  /api/download/<meeting_id>
- POST /api/discard/<meeting_id>
- POST /api/detect_questions
- POST /api/translate_content
- GET  /api/settings, PUT /api/settings
- POST /api/open_transcripts
- POST /api/debug/log
"""

import logging
import os
import subprocess
import threading
import time
from flask import Blueprint, request, jsonify, send_file, abort, url_for, current_app
from werkzeug.utils import secure_filename
from io import BytesIO

from ..services import translation, qa_detection, export
from ..services.transcription_service import transcribe
from ..services.summary_service import summarize
from ..services.process_service import (
    run_process_job,
    get_job_status,
    set_job_progress,
    translate_results_back,
)
from ..services.openai_wrapper import OpenAIError, OpenAITimeoutError
from ..models import Setting
from ..config import UPLOAD_FOLDER, TRANSCRIPT_FOLDER, LOG_FOLDER, MAX_FILE_AGE_SECONDS

logger = logging.getLogger(__name__)

api = Blueprint("api", __name__, url_prefix="/api")


@api.before_request
def before_request():
    if not export.TRANSCRIPT_FOLDER:
        export.set_transcript_folder(TRANSCRIPT_FOLDER)


def _cleanup_old_files() -> None:
    """Delete old audio and transcript files (older than MAX_FILE_AGE_SECONDS)."""
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


def _error_response(message: str, status: int = 500):
    return jsonify({"error": message}), status


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------


@api.route("/health", methods=["GET"])
def health():
    try:
        return jsonify({"status": "ok"}), 200
    except Exception as e:
        logger.exception("Health check failed: %s", e)
        return _error_response("Service unavailable", 503)


# ---------------------------------------------------------------------------
# Process (async + sync)
# ---------------------------------------------------------------------------


@api.route("/process/status/<job_id>", methods=["GET"])
def process_status(job_id):
    try:
        data = get_job_status(job_id)
        if data is None:
            logger.info("Process status: job_id=%s -> 404 not_found", job_id)
            return jsonify({
                "status": "not_found",
                "progress": 0,
                "message": "Unknown job.",
            }), 404
        logger.info("Process status: job_id=%s -> %s (progress=%s)", job_id, data.get("status"), data.get("progress"))
        if data.get("status") == "completed" and data.get("result"):
            result = data["result"]
            if isinstance(result, dict):
                result = result.copy()
                mid = result.get("meeting_id")
                if mid:
                    result["download_url"] = url_for("api.download_pdf", meeting_id=mid)
                    result["discard_url"] = url_for("api.discard_meeting", meeting_id=mid)
                data = {**data, "result": result}
        return jsonify(data), 200
    except Exception as e:
        logger.exception("Process status error: %s", e)
        return _error_response(str(e), 500)


@api.route("/process", methods=["POST"])
def process_audio():
    try:
        _cleanup_old_files()

        if "audio_file" not in request.files:
            return _error_response("No file part in request.", 400)
        file = request.files["audio_file"]
        if file.filename == "":
            return _error_response("No file selected.", 400)

        filename = secure_filename(file.filename)
        save_path = os.path.join(UPLOAD_FOLDER, filename)
        file.save(save_path)
        logger.info("Saved audio file: %s", os.path.abspath(save_path))

        agenda = request.form.get("agenda", "").strip()
        job_id = request.form.get("progress_job_id", "").strip()
        user_id = 1
        if "user_id" in request.form:
            try:
                user_id = int(request.form["user_id"])
            except (TypeError, ValueError):
                pass

        # Async path: start job, optionally wait for completion (avoids client polling)
        if job_id:
            set_job_progress(job_id, "processing", 0.05, "Starting…")
            app = current_app._get_current_object()
            thread = threading.Thread(
                target=run_process_job,
                args=(job_id, save_path, filename, agenda, user_id, app),
                daemon=True,
            )
            thread.start()
            wait_for_completion = request.form.get("wait_for_completion", "").strip().lower() in ("1", "true", "yes")
            if wait_for_completion:
                timeout_sec = 120
                poll_interval = 0.5
                elapsed = 0.0
                while elapsed < timeout_sec:
                    time.sleep(poll_interval)
                    elapsed += poll_interval
                    data = get_job_status(job_id)
                    if data is None:
                        continue
                    if data.get("status") == "completed" and data.get("result"):
                        result = data["result"].copy() if isinstance(data.get("result"), dict) else {}
                        mid = result.get("meeting_id")
                        if mid:
                            result["download_url"] = url_for("api.download_pdf", meeting_id=mid)
                            result["discard_url"] = url_for("api.discard_meeting", meeting_id=mid)
                        return jsonify(result), 200
                    if data.get("status") == "error":
                        return _error_response(data.get("error") or data.get("message") or "Processing failed.", 502)
                return jsonify({
                    "job_id": job_id,
                    "status": "processing",
                    "message": "Poll GET /api/process/status/<job_id> for progress.",
                }), 202
            return jsonify({
                "job_id": job_id,
                "status": "processing",
                "message": "Poll GET /api/process/status/<job_id> for progress.",
            }), 202

        # Sync path (no job_id): run pipeline and return result
        transcribe_result = transcribe(save_path)
        if transcribe_result is None:
            return _error_response("Transcription returned no result.", 502)
        transcript_text, source_language = transcribe_result
        original_transcript = transcript_text

        translate_result = translation.detect_and_translate_if_needed(
            transcript_text, source_language
        )
        if translate_result is None:
            return _error_response("Translation returned no result.", 502)
        translated_transcript, detected_language, was_translated = translate_result

        summary_result = summarize(
            translated_transcript, agenda, detected_language, user_id=user_id
        )
        if summary_result is None:
            summary_result = ("", [], {})
        summary, action_items, memo_json = summary_result
        original_summary = summary
        original_action_items = action_items
        if was_translated and detected_language and detected_language.lower() != "english":
            original_summary, original_action_items = translate_results_back(
                summary, action_items, detected_language
            )

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
            logger.exception("Failed to save meeting artifacts: %s", e)
            return _error_response(f"Failed to save meeting: {e}", 500)
        try:
            os.remove(save_path)
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
        }), 200

    except (OpenAITimeoutError, OpenAIError) as e:
        logger.exception("Process upstream error: %s", e)
        return _error_response("Upstream API error. Try again.", 502)
    except Exception as e:
        logger.exception("Process error: %s", e)
        return _error_response(str(e), 500)


# ---------------------------------------------------------------------------
# Download / Discard
# ---------------------------------------------------------------------------


@api.route("/download/<meeting_id>", methods=["GET"])
def download_pdf(meeting_id):
    try:
        data = export.load_meeting_artifacts(meeting_id)
    except (ValueError, FileNotFoundError):
        logger.warning("Meeting not found: %s", meeting_id)
        return _error_response("Meeting not found.", 404)
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
        return _error_response("Error generating PDF.", 500)


@api.route("/discard/<meeting_id>", methods=["POST"])
def discard_meeting(meeting_id):
    try:
        export.safe_meeting_id(meeting_id)
        export.delete_meeting_artifacts(meeting_id)
        return jsonify({"status": "discarded", "meeting_id": meeting_id}), 200
    except ValueError:
        return _error_response("Invalid meeting ID.", 400)
    except Exception as e:
        logger.exception("Error discarding meeting: %s", e)
        return _error_response("Could not discard meeting.", 500)


# ---------------------------------------------------------------------------
# Detect questions
# ---------------------------------------------------------------------------


@api.route("/detect_questions", methods=["POST"])
def detect_questions():
    try:
        data = request.get_json() or {}
        new_transcript = (data.get("new_transcript") or "").strip()
        full_transcript = (data.get("full_transcript") or "").strip()
        if not new_transcript or len(new_transcript) < 20:
            return jsonify({"questions": []}), 200
        questions = qa_detection.detect_and_answer_questions(
            new_transcript, full_transcript
        )
        return jsonify({"questions": questions}), 200
    except Exception as e:
        logger.exception("Question detection error: %s", e)
        return jsonify({"questions": [], "error": str(e)}), 500


# ---------------------------------------------------------------------------
# Settings
# ---------------------------------------------------------------------------


@api.route("/settings", methods=["GET", "PUT"])
def settings():
    user_id = 1
    try:
        if request.method == "GET":
            keys = ["default_language", "summary_language", "auto_detect_qa"]
            settings_map = {key: Setting.get(key, user_id=user_id) for key in keys}
            return jsonify({"settings": settings_map}), 200

        payload = request.get_json(silent=True) or {}
        incoming = (
            payload.get("settings")
            if isinstance(payload.get("settings"), dict)
            else payload
        )
        if not isinstance(incoming, dict):
            return _error_response("Invalid settings payload.", 400)
        updated = {}
        for key, value in incoming.items():
            if isinstance(value, bool):
                data_type, stored_value = "bool", "true" if value else "false"
            elif isinstance(value, int):
                data_type, stored_value = "int", str(value)
            elif isinstance(value, (dict, list)):
                data_type, stored_value = "json", value
            else:
                data_type, stored_value = "string", str(value)
            Setting.set(key, stored_value, data_type=data_type, user_id=user_id)
            updated[key] = value
        return jsonify({"status": "ok", "settings": updated}), 200
    except Exception as e:
        logger.exception("Settings error: %s", e)
        return _error_response(str(e), 500)


# ---------------------------------------------------------------------------
# Translate content
# ---------------------------------------------------------------------------


@api.route("/translate_content", methods=["POST"])
def translate_content():
    try:
        data = request.get_json() or {}
        summary = (data.get("summary") or "").strip()
        transcript = (data.get("transcript") or "").strip()
        target_language = (data.get("target_language") or "English").strip()
        if not summary or not transcript:
            return _error_response("summary and transcript are required", 400)
        if target_language.lower() == "english":
            translated_summary, translated_transcript = summary, transcript
        else:
            translated_summary = translation.translate_text(summary, target_language)
            translated_transcript = translation.translate_text(transcript, target_language)
        return jsonify({
            "translated_summary": translated_summary,
            "translated_transcript": translated_transcript,
        }), 200
    except Exception as e:
        logger.exception("Translation error: %s", e)
        return _error_response(str(e), 500)


# ---------------------------------------------------------------------------
# Open transcripts folder
# ---------------------------------------------------------------------------


@api.route("/open_transcripts", methods=["POST"])
def open_transcripts():
    try:
        folder = os.path.abspath(TRANSCRIPT_FOLDER)
        subprocess.run(["open", folder], check=True)
        return jsonify({"status": "ok"}), 200
    except Exception as e:
        logger.warning("Could not open transcripts folder: %s", e)
        return _error_response("Could not open transcripts folder.", 500)


# ---------------------------------------------------------------------------
# Debug log (client)
# ---------------------------------------------------------------------------


@api.route("/debug/log", methods=["POST"])
def debug_log():
    try:
        payload = request.get_json(silent=True) or {}
        level = (payload.get("level") or "info").upper()
        message = payload.get("message") or ""
        meta = payload.get("meta") or {}
        from datetime import datetime
        ts = datetime.utcnow().isoformat() + "Z"
        entry = f"{ts} [{level}] {message} | meta={meta}\n"
        try:
            client_log_path = os.path.join(LOG_FOLDER, "client_debug.log")
            with open(client_log_path, "a", encoding="utf-8") as fh:
                fh.write(entry)
        except Exception as e:
            logger.warning("Failed to write client debug log: %s", e)
        if level in ("ERROR", "ERR"):
            logger.error("[client] %s -- meta=%s", message, meta)
        elif level in ("WARN", "WARNING"):
            logger.warning("[client] %s -- meta=%s", message, meta)
        else:
            logger.info("[client] %s -- meta=%s", message, meta)
        return jsonify({"status": "ok"}), 200
    except Exception as e:
        logger.exception("Error handling client debug log: %s", e)
        return _error_response("Internal error", 500)
