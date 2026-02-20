"""
Transcription service using OpenAI Whisper.

Handles audio file transcription for all supported audio formats.
Decision: Whisper only (Phase 3: can add Deepgram/AssemblyAI support).
"""

import logging
from openai import OpenAI

from .openai_wrapper import call_with_timeout, OpenAIError, OpenAITimeoutError

logger = logging.getLogger(__name__)

# Initialize OpenAI client
client = OpenAI()  # reads OPENAI_API_KEY from environment


def transcribe_audio_file(file_path: str) -> tuple[str, str]:
    """
    Transcribe audio file using OpenAI Whisper. Uses a wrapper to enforce a
    timeout so the request doesn't block indefinitely.
    """
    logger.info("Transcribing file: %s", file_path)

    def _call():
        # Open file inside the worker thread to avoid file handle lifetime issues
        with open(file_path, "rb") as f:
            return client.audio.transcriptions.create(
                model="whisper-1",
                file=f,
                language=None,  # Auto-detect language
            )

    # Large files can take several minutes; allow up to 10 minutes for Whisper
    try:
        result = call_with_timeout(_call, timeout=600, name="whisper.transcribe")
    except OpenAITimeoutError:
        logger.exception("Transcription timed out for %s", file_path)
        raise
    except OpenAIError as e:
        logger.exception("Transcription API error: %s", e)
        raise

    transcript = getattr(result, "text", "") or ""
    detected_language_code = getattr(result, "language", "en") or "en"

    logger.info(
        "Successfully transcribed %s (%s) - %d characters",
        file_path,
        detected_language_code,
        len(transcript),
    )

    return transcript, detected_language_code
