"""
Summary service – public API for meeting summarization and action-item extraction.

Delegates to the underlying summarization implementation.
"""

import logging
from typing import Any

from . import summarization
from .openai_wrapper import OpenAIError, OpenAITimeoutError

logger = logging.getLogger(__name__)


def summarize(
    transcript: str,
    agenda: str = "",
    detected_language: str = "English",
    user_id: int = 1,
) -> tuple[str, list, dict[str, Any]] | None:
    """
    Summarize a transcript and extract action items.

    Args:
        transcript: Full transcript text (English or original).
        agenda: Optional meeting agenda.
        detected_language: Detected language name.
        user_id: User id for context (Phase 1: 1).

    Returns:
        (summary_text, action_items_list, memo_json) or None on failure.
    """
    try:
        return summarization.summarize_and_extract_actions(
            transcript, agenda, detected_language, user_id=user_id
        )
    except (OpenAITimeoutError, OpenAIError) as e:
        logger.exception("Summary service error: %s", e)
        raise
