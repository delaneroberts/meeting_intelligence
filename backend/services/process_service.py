"""
Process service – async pipeline: transcribe → translate → summarize → save.

Orchestrates the full meeting processing job. Used by the API layer;
returns job_id and supports status polling.
"""

import logging
import os
from typing import Any, Callable

from . import translation
from . import export
from .transcription_service import transcribe, process_audio as whisperx_process_audio
from .summary_service import summarize
from .openai_wrapper import OpenAIError, OpenAITimeoutError, call_with_timeout

logger = logging.getLogger(__name__)

# In-memory job progress for long-polling (job_id -> { status, progress, message, result?, error? })
JOB_PROGRESS: dict[str, dict[str, Any]] = {}


def _persist_job_progress(job_id: str, data: dict[str, Any]) -> None:
    """Write job progress to DB so status survives process restarts (e.g. Flask reloader)."""
    from backend.models import ProcessJob, db
    import sqlalchemy.exc as sa_exc

    def _do_persist() -> None:
        row = ProcessJob.query.get(job_id)
        if row is None:
            row = ProcessJob(job_id=job_id)
            db.session.add(row)
        row.status = data.get("status", "processing")
        row.progress = float(data.get("progress", 0))
        row.message = (data.get("message") or "")[:256]
        row.result = data.get("result")
        row.error = data.get("error")
        db.session.commit()

    try:
        _do_persist()
    except sa_exc.OperationalError as e:
        err_msg = str(e.orig) if getattr(e, "orig", None) else str(e)
        if "no such table" in err_msg.lower() or "process_jobs" in str(e).lower():
            try:
                db.create_all()
                db.session.rollback()
                _do_persist()
                logger.info("Created process_jobs table and persisted job %s", job_id)
            except Exception as e2:
                logger.warning("Could not persist job progress for %s (create_all retry failed): %s", job_id, e2)
        else:
            logger.warning("Could not persist job progress for %s: %s", job_id, e)
    except Exception as e:
        logger.warning("Could not persist job progress for %s: %s", job_id, e)


def _translate_results_back(
    summary: str, action_items: list, target_language: str
) -> tuple[str, list]:
    """Translate summary and action items back to original language."""
    if not target_language or target_language.lower() == "unknown":
        return summary, action_items

    try:
        translated_summary = translation.translate_text(summary, target_language)
    except Exception as e:
        logger.warning("Could not translate summary to %s: %s", target_language, e)
        translated_summary = summary

    try:
        action_items_text = "\n".join(action_items)
        translated_items = translation.translate_text(action_items_text, target_language)
        translated_action_items = [
            item.strip() for item in translated_items.split("\n") if item.strip()
        ]
    except Exception as e:
        logger.warning("Could not translate action items to %s: %s", target_language, e)
        translated_action_items = action_items

    return translated_summary, translated_action_items


def run_process_job(
    job_id: str,
    save_path: str,
    filename: str,
    agenda: str,
    user_id: int,
    app,
) -> None:
    """
    Run the full transcribe/translate/summarize pipeline and update JOB_PROGRESS.
    Must run inside Flask app context (for DB and config).
    """
    def set_progress(status: str, progress: float, message: str, **extra: Any) -> None:
        JOB_PROGRESS[job_id] = {
            **JOB_PROGRESS.get(job_id, {}),
            "status": status,
            "progress": progress,
            "message": message,
            **extra,
        }
        _persist_job_progress(job_id, JOB_PROGRESS[job_id])

    with app.app_context():
        _run_impl(job_id, save_path, filename, agenda, user_id, set_progress, app)


def _run_impl(
    job_id: str,
    save_path: str,
    filename: str,
    agenda: str,
    user_id: int,
    set_progress: Callable[..., None],
    app,
) -> None:
    try:
        set_progress("transcribing", 0.1, "Transcribing…")
        segments = None
        # Prefer WhisperX (diarization + aligned timestamps) when available
        wx_result = whisperx_process_audio(save_path)
        if wx_result is not None:
            segments, source_language, transcript_text = wx_result
        else:
            transcribe_result = transcribe(save_path)
            if transcribe_result is None:
                set_progress(
                    "error", 0, "Transcription returned no result.",
                    error="Transcription returned no result."
                )
                return
            transcript_text, source_language = transcribe_result
        original_transcript = transcript_text

        set_progress("translating", 0.35, "Translating…")
        translate_result = translation.detect_and_translate_if_needed(
            transcript_text, source_language
        )
        if translate_result is None:
            set_progress(
                "error", 0, "Translation returned no result.",
                error="Translation returned no result."
            )
            return
        translated_transcript, detected_language, was_translated = translate_result

        set_progress("summarizing", 0.6, "Generating summary…")
        logger.info("Starting summarization (timeout 90s)")
        try:
            def _summarize_with_context():
                with app.app_context():
                    return summarize(
                        translated_transcript, agenda, detected_language, user_id=user_id
                    )
            summary_result = call_with_timeout(
                _summarize_with_context,
                timeout=90,
                name="process.summarize",
            )
        except OpenAITimeoutError:
            logger.exception("Summarization timed out after 90s")
            set_progress(
                "error", 0, "Summarization timed out.",
                error="Summarization timed out. Please try again."
            )
            return
        except OpenAIError as e:
            logger.exception("Summarization failed: %s", e)
            set_progress(
                "error", 0, str(e) or "Summarization failed.",
                error=str(e) or "Summarization failed."
            )
            return
        logger.info("Summarization finished")
        if summary_result is None:
            set_progress(
                "error", 0, "Summarization returned no result.",
                error="Summarization returned no result."
            )
            return
        summary, action_items, memo_json = summary_result
        original_summary = summary
        original_action_items = action_items
        if was_translated and detected_language and detected_language.lower() != "english":
            original_summary, original_action_items = _translate_results_back(
                summary, action_items, detected_language
            )

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
        if segments is not None:
            result["segments"] = segments
        set_progress("completed", 1.0, "Done", result=result)
    except (OpenAITimeoutError, OpenAIError) as e:
        logger.exception("Job %s upstream error: %s", job_id, e)
        set_progress("error", 0, str(e) or "Upstream API error.", error=str(e))
    except TypeError as e:
        if "unpack" in str(e).lower() or "non-iterable" in str(e).lower():
            logger.exception(
                "Job %s: unexpected None or wrong shape from a step: %s", job_id, e
            )
            set_progress(
                "error", 0,
                "A processing step returned an invalid result. Try again.",
                error=str(e),
            )
        else:
            raise
    except Exception as e:
        logger.exception("Job %s failed: %s", job_id, e)
        set_progress("error", 0, str(e) or "Processing failed.", error=str(e))


def get_job_status(job_id: str) -> dict[str, Any] | None:
    """Return current progress dict for a job, or None if not found. Checks memory then DB."""
    data = JOB_PROGRESS.get(job_id)
    if data is not None:
        return data
    try:
        from backend.models import ProcessJob
        row = ProcessJob.query.get(job_id)
        if row is not None:
            return row.to_status_dict()
    except Exception as e:
        logger.warning("Could not load job progress from DB for %s: %s", job_id, e)
    return None


def set_job_progress(job_id: str, status: str, progress: float, message: str, **extra: Any) -> None:
    """Initialize or update job progress (used by API when starting a job). Persists to DB."""
    JOB_PROGRESS[job_id] = {
        **JOB_PROGRESS.get(job_id, {}),
        "status": status,
        "progress": progress,
        "message": message,
        **extra,
    }
    _persist_job_progress(job_id, JOB_PROGRESS[job_id])


def translate_results_back(
    summary: str, action_items: list, target_language: str
) -> tuple[str, list]:
    """Translate summary and action items back to original language (for sync path)."""
    return _translate_results_back(summary, action_items, target_language)
