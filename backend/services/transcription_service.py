"""
Transcription service – public API for audio transcription.

- transcribe(audio_path): Returns (full_text, language_code) for the existing pipeline.
  Uses OpenAI Whisper by default.

- process_audio(audio_path): Returns (segments, language_code, full_text) using WhisperX
  with speaker diarization and aligned timestamps. Segments are formatted as:
  [{"speaker": "SPEAKER_00", "start": 0.0, "end": 5.2, "text": "Hello world"}, ...]
"""

import gc
import logging
import os
from typing import Any

# Load .env from project root if available (for HF_TOKEN, OPENAI_API_KEY, etc.)
try:
    from dotenv import load_dotenv
    from pathlib import Path
    _root = Path(__file__).resolve().parent.parent.parent
    load_dotenv(str(_root / ".env"))
except ImportError:
    pass

from . import transcription
from .openai_wrapper import OpenAIError, OpenAITimeoutError

logger = logging.getLogger(__name__)

# Optional WhisperX
_WHISPERX_AVAILABLE = False
_WHISPERX_IMPORT_ERROR = None
try:
    import whisperx
    from whisperx import load_audio, load_model
    from whisperx.alignment import load_align_model, align
    from whisperx.diarize import DiarizationPipeline, assign_word_speakers
    _WHISPERX_AVAILABLE = True
except ImportError as e:
    _WHISPERX_IMPORT_ERROR = str(e)
    logger.debug("WhisperX not available: %s", e)


def _log_whisperx_status() -> None:
    """Log once at startup whether WhisperX is usable and HF_TOKEN is set."""
    hf_set = bool(os.getenv("HF_TOKEN") or os.getenv("HUGGING_FACE_HUB_TOKEN"))
    if _WHISPERX_AVAILABLE:
        logger.info("WhisperX: available=True, HF_TOKEN set=%s", hf_set)
    else:
        logger.info(
            "WhisperX: available=False (import failed: %s). Using OpenAI Whisper for transcription.",
            _WHISPERX_IMPORT_ERROR or "unknown",
        )


_log_whisperx_status()


def transcribe(audio_path: str) -> tuple[str, str] | None:
    """
    Transcribe an audio file to text and detect language (OpenAI Whisper).
    Use for backward compatibility when WhisperX is not required.
    """
    try:
        return transcription.transcribe_audio_file(audio_path)
    except (OpenAITimeoutError, OpenAIError) as e:
        logger.exception("Transcription service error: %s", e)
        raise


def _segments_to_list(whisperx_result: dict[str, Any]) -> list[dict[str, Any]]:
    """Convert WhisperX result segments to [{"speaker", "start", "end", "text"}, ...]."""
    out = []
    for seg in whisperx_result.get("segments", []):
        out.append({
            "speaker": seg.get("speaker") or "SPEAKER_00",
            "start": float(seg.get("start", 0.0)),
            "end": float(seg.get("end", 0.0)),
            "text": (seg.get("text") or "").strip(),
        })
    return out


def _full_text_from_segments(segments: list[dict[str, Any]]) -> str:
    """Build a single transcript string from segments (plain concatenation)."""
    return " ".join(s["text"] for s in segments if s.get("text")).strip()


def _speaker_label(speaker: str) -> str:
    """Convert SPEAKER_00 -> Speaker 0, SPEAKER_01 -> Speaker 1, etc."""
    if not speaker:
        return "Speaker 0"
    s = str(speaker).strip().upper()
    if s.startswith("SPEAKER_"):
        try:
            num = int(s.replace("SPEAKER_", ""), 10)
            return f"Speaker {num}"
        except ValueError:
            pass
    return speaker


def transcript_with_speakers_from_segments(segments: list[dict[str, Any]]) -> str:
    """Build transcript with 'Speaker 0:', 'Speaker 1:' etc. for display."""
    lines = []
    for s in segments:
        text = (s.get("text") or "").strip()
        if not text:
            continue
        label = _speaker_label(s.get("speaker") or "SPEAKER_00")
        lines.append(f"{label}: {text}")
    return "\n\n".join(lines) if lines else ""


def process_audio(file_path: str) -> tuple[list[dict[str, Any]], str, str] | None:
    """
    Transcribe audio with WhisperX, align for precise timestamps, and run speaker diarization.

    Uses device='mps' (Mac GPU) and compute_type='float16'. Requires HF_TOKEN in env
    (or .env) for pyannote diarization models.

    Returns:
        (segments, language_code, full_text) or None on failure.
        Each segment: {"speaker": "SPEAKER_00", "start": 0.0, "end": 5.2, "text": "Hello world"}
    """
    if not _WHISPERX_AVAILABLE:
        logger.error("WhisperX is not installed. Install with: pip install whisperx")
        return None

    hf_token = os.getenv("HF_TOKEN") or os.getenv("HUGGING_FACE_HUB_TOKEN")
    if not hf_token:
        logger.warning("HF_TOKEN not set; diarization may fail for pyannote models.")

    # Prefer MPS (Mac GPU); fall back to CPU if MPS unavailable
    device = "mps"
    try:
        import torch
        if not torch.backends.mps.is_available():
            device = "cpu"
            logger.info("MPS not available, using CPU")
    except Exception:
        device = "cpu"
    compute_type = "float16"
    model_name = "base"  # balance of speed/quality; use "large-v2" for best quality

    try:
        logger.info("WhisperX loading audio: %s", file_path)
        audio = load_audio(file_path)

        logger.info("WhisperX loading model (device=%s, compute_type=%s)", device, compute_type)
        model = load_model(
            model_name,
            device=device,
            compute_type=compute_type,
            language=None,  # auto-detect
        )

        logger.info("WhisperX transcribing...")
        result = model.transcribe(audio, batch_size=16)
        language = result.get("language", "en")
        if not result.get("segments"):
            logger.warning("WhisperX returned no segments")
            del model
            gc.collect()
            return None

        # Unload ASR model before alignment
        del model
        gc.collect()
        if device == "cuda":
            import torch
            torch.cuda.empty_cache()

        # Align for precise timestamps (skip if no align model for this language)
        try:
            logger.info("WhisperX loading align model (language=%s)...", language)
            align_model, align_metadata = load_align_model(language_code=language, device=device)
            logger.info("WhisperX aligning...")
            result = align(
                result["segments"],
                align_model,
                align_metadata,
                audio,
                device,
            )
            del align_model
            gc.collect()
        except (ValueError, Exception) as e:
            logger.warning("WhisperX alignment skipped for language %s: %s", language, e)
            result = {"segments": result["segments"], "language": language}
        if isinstance(result, dict) and "language" not in result:
            result["language"] = language

        # Diarization (requires HF_TOKEN; pyannote model may require Hugging Face agreement)
        logger.info("WhisperX diarizing...")
        diarize_model = DiarizationPipeline(
            model_name="pyannote/speaker-diarization-3.1",
            token=hf_token,
            device=device,
        )
        diarize_segments = diarize_model(
            file_path,
            min_speakers=None,
            max_speakers=None,
        )
        result = assign_word_speakers(diarize_segments, result)
        del diarize_model
        gc.collect()

        segments = _segments_to_list(result)
        full_text = transcript_with_speakers_from_segments(segments) or _full_text_from_segments(segments)
        lang_code = result.get("language", language) if isinstance(result.get("language"), str) else language

        logger.info("WhisperX done: %d segments, language=%s", len(segments), lang_code)
        return (segments, lang_code, full_text)

    except Exception as e:
        logger.exception("WhisperX process_audio failed: %s", e)
        return None
