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
import time
import warnings
from typing import Any

# Suppress pyannote/torchcodec UserWarning (torchcodec has compatibility issues on Mac;
# pyannote falls back to other audio loaders and works fine)
warnings.filterwarnings("ignore", message=".*torchcodec.*", category=UserWarning)
warnings.filterwarnings("ignore", module="pyannote.audio.core.io", category=UserWarning)

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
    import numpy as np
    import whisperx
    from whisperx import load_audio, load_model
    from whisperx.alignment import load_align_model, align
    from whisperx.diarize import DiarizationPipeline
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


class _SpeakerIntervalTree:
    """
    Interval tree using sorted NumPy arrays and binary search for O(log n) overlap queries.
    Avoids pandas iterrows and Python loops in hot path.
    """

    def __init__(self, starts: "np.ndarray", ends: "np.ndarray", speakers: list[str]) -> None:
        order = np.argsort(starts)
        self._starts = np.asarray(starts, dtype=np.float64)[order]
        self._ends = np.asarray(ends, dtype=np.float64)[order]
        self._speakers = [speakers[i] for i in order]
        self._n = len(self._starts)

    def query_overlaps(self, q_start: float, q_end: float) -> list[tuple[str, float]]:
        """Return (speaker, intersection_duration) for all overlapping intervals."""
        if self._n == 0:
            return []
        # Binary search: intervals with start >= q_end cannot overlap
        right = np.searchsorted(self._starts, q_end, side="left")
        if right == 0:
            return []
        # Vectorized overlap check: end > q_start for candidates [0, right)
        mask = self._ends[:right] > q_start
        indices = np.where(mask)[0]
        if len(indices) == 0:
            return []
        # Vectorized intersection duration
        overlap_starts = np.maximum(self._starts[indices], q_start)
        overlap_ends = np.minimum(self._ends[indices], q_end)
        durations = overlap_ends - overlap_starts
        return [
            (self._speakers[int(i)], float(durations[j]))
            for j, i in enumerate(indices)
            if durations[j] > 0
        ]

    def find_nearest(self, t: float) -> str | None:
        """Return speaker of nearest interval by midpoint distance."""
        if self._n == 0:
            return None
        mids = (self._starts + self._ends) * 0.5
        idx = int(np.argmin(np.abs(mids - t)))
        return self._speakers[idx]


def _assign_speaker_from_overlaps(overlaps: list[tuple[str, float]]) -> str | None:
    """Pick dominant speaker by summed intersection duration."""
    if not overlaps:
        return None
    by_speaker: dict[str, float] = {}
    for spk, dur in overlaps:
        by_speaker[spk] = by_speaker.get(spk, 0.0) + dur
    return max(by_speaker.items(), key=lambda x: x[1])[0]


def _assign_word_speakers_optimized(
    diarize_df: Any,
    transcript_result: dict[str, Any],
    fill_nearest: bool = False,
) -> dict[str, Any]:
    """
    Assign speakers to segments and words using interval tree with binary search.
    Uses NumPy arrays directly (no pandas iterrows) for faster construction and queries.
    """
    transcript_segments = transcript_result.get("segments") or []
    if not transcript_segments or diarize_df is None or len(diarize_df) == 0:
        return transcript_result

    # Extract arrays directly (no iterrows); pandas Series have .values
    starts = np.asarray(diarize_df["start"], dtype=np.float64)
    ends = np.asarray(diarize_df["end"], dtype=np.float64)
    speakers = diarize_df["speaker"].tolist()
    tree = _SpeakerIntervalTree(starts, ends, speakers)

    for seg in transcript_segments:
        seg_start = float(seg.get("start", 0.0))
        seg_end = float(seg.get("end", 0.0))
        overlaps = tree.query_overlaps(seg_start, seg_end)
        spk = _assign_speaker_from_overlaps(overlaps) if overlaps else None
        if spk is not None:
            seg["speaker"] = spk
        elif fill_nearest:
            spk = tree.find_nearest((seg_start + seg_end) * 0.5)
            if spk:
                seg["speaker"] = spk

        words = seg.get("words")
        if words:
            for w in words:
                ws = w.get("start")
                if ws is None:
                    continue
                we = w.get("end", ws)
                overlaps = tree.query_overlaps(float(ws), float(we))
                spk = _assign_speaker_from_overlaps(overlaps) if overlaps else None
                if spk is not None:
                    w["speaker"] = spk
                elif fill_nearest:
                    spk = tree.find_nearest(float(ws) + (float(we) - float(ws)) * 0.5)
                    if spk:
                        w["speaker"] = spk

    return transcript_result


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

    # Prefer MPS (Mac GPU); fallback to CPU if MPS/float16 unsupported
    device = "mps"
    compute_type = "float16"
    model_name = "large-v3-turbo"

    try:
        t_pipeline_start = time.perf_counter()

        t0 = time.perf_counter()
        logger.info("WhisperX loading audio: %s", file_path)
        audio = load_audio(file_path)
        logger.info("[TIMING] load_audio: %.2fs", time.perf_counter() - t0)

        # Try MPS + float16; fallback to float32, then CPU if MPS unsupported (e.g. ctranslate2)
        t0 = time.perf_counter()
        try:
            logger.info("WhisperX loading model (device=%s, compute_type=%s)", device, compute_type)
            model = load_model(
                model_name,
                device=device,
                compute_type=compute_type,
                language=None,
            )
            logger.info("[TIMING] load_model: %.2fs", time.perf_counter() - t0)
        except Exception as e:
            logger.warning("WhisperX MPS float16 failed (%s), trying float32", e)
            try:
                t0 = time.perf_counter()
                compute_type = "float32"
                model = load_model(
                    model_name,
                    device=device,
                    compute_type=compute_type,
                    language=None,
                )
                logger.info("[TIMING] load_model (float32): %.2fs", time.perf_counter() - t0)
            except Exception as e2:
                logger.warning("WhisperX MPS failed (%s), falling back to CPU", e2)
                t0 = time.perf_counter()
                device = "cpu"
                compute_type = "float32"
                model = load_model(
                    model_name,
                    device=device,
                    compute_type=compute_type,
                    language=None,
                )
                logger.info("[TIMING] load_model (CPU): %.2fs", time.perf_counter() - t0)

        t0 = time.perf_counter()
        logger.info("WhisperX transcribing...")
        result = model.transcribe(audio, batch_size=32)
        logger.info("[TIMING] transcribe: %.2fs", time.perf_counter() - t0)
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
            t0 = time.perf_counter()
            logger.info("WhisperX loading align model (language=%s)...", language)
            align_model, align_metadata = load_align_model(language_code=language, device=device)
            logger.info("[TIMING] load_align_model: %.2fs", time.perf_counter() - t0)
            t0 = time.perf_counter()
            logger.info("WhisperX aligning...")
            result = align(
                result["segments"],
                align_model,
                align_metadata,
                audio,
                device,
            )
            logger.info("[TIMING] align: %.2fs", time.perf_counter() - t0)
            del align_model
            gc.collect()
        except (ValueError, Exception) as e:
            logger.warning("WhisperX alignment skipped for language %s: %s", language, e)
            result = {"segments": result["segments"], "language": language}
        if isinstance(result, dict) and "language" not in result:
            result["language"] = language

        # Diarization (requires HF_TOKEN; pyannote model may require Hugging Face agreement)
        t0 = time.perf_counter()
        logger.info("WhisperX diarizing...")
        diarize_model = DiarizationPipeline(
            model_name="pyannote/speaker-diarization-3.0",
            token=hf_token,
            device=device,
        )
        logger.info("[TIMING] DiarizationPipeline init: %.2fs", time.perf_counter() - t0)
        t0 = time.perf_counter()
        diarize_segments = diarize_model(
            file_path,
            min_speakers=None,
            max_speakers=None,
        )
        logger.info("[TIMING] diarize_model() call: %.2fs", time.perf_counter() - t0)
        t0 = time.perf_counter()
        result = _assign_word_speakers_optimized(diarize_segments, result, fill_nearest=True)
        logger.info("[TIMING] assign_word_speakers: %.2fs", time.perf_counter() - t0)
        del diarize_model
        gc.collect()

        segments = _segments_to_list(result)
        full_text = transcript_with_speakers_from_segments(segments) or _full_text_from_segments(segments)
        lang_code = result.get("language", language) if isinstance(result.get("language"), str) else language

        t_pipeline_total = time.perf_counter() - t_pipeline_start
        logger.info("[TIMING] WhisperX pipeline total: %.2fs", t_pipeline_total)
        logger.info("WhisperX done: %d segments, language=%s", len(segments), lang_code)
        return (segments, lang_code, full_text)

    except Exception as e:
        logger.exception("WhisperX process_audio failed: %s", e)
        return None
