"""
Transcription service using OpenAI Whisper.

Handles audio file transcription for all supported audio formats.
Decision: Whisper only (Phase 3: can add Deepgram/AssemblyAI support).
"""

import logging
from openai import OpenAI

logger = logging.getLogger(__name__)

# Initialize OpenAI client
client = OpenAI()  # reads OPENAI_API_KEY from environment


def transcribe_audio_file(file_path: str) -> tuple[str, str]:
    """
    Transcribe audio file using OpenAI Whisper.
    
    Args:
        file_path: Path to audio file (supports mp3, mp4, mpeg, mpga, m4a, wav, webm)
    
    Returns:
        Tuple of (transcript_text, detected_language_code)
        
    Raises:
        FileNotFoundError: If audio file doesn't exist
        Exception: On API or file read errors
    """
    logger.info("Transcribing file: %s", file_path)
    
    try:
        with open(file_path, "rb") as f:
            result = client.audio.transcriptions.create(
                model="whisper-1",
                file=f,
                language=None,  # Auto-detect language
            )
    except FileNotFoundError:
        logger.error("Audio file not found: %s", file_path)
        raise
    except Exception as e:
        logger.exception("Transcription API error: %s", e)
        raise
    
    transcript = result.text or ""
    # Whisper returns language code (e.g., 'en', 'es', 'fr')
    detected_language_code = getattr(result, 'language', 'en') or 'en'
    
    logger.info(
        "Successfully transcribed %s (%s) - %d characters",
        file_path,
        detected_language_code,
        len(transcript)
    )
    
    return transcript, detected_language_code
