"""
openai_wrapper.py

A small, reliable wrapper around the OpenAI Python SDK that:
- NEVER uses a placeholder key
- Avoids creating the OpenAI client at import time (prevents "captured bad env" bugs)
- Provides a simple timeout wrapper for blocking SDK calls
- Exposes the names your app imports:
    - OpenAIError
    - OpenAITimeoutError
    - call_with_timeout
"""

from __future__ import annotations

import os
import logging
from typing import Any, Callable, Optional
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeoutError

from openai import OpenAI

logger = logging.getLogger(__name__)

# ---- Errors your app imports ----

class OpenAIError(Exception):
    """Base error for OpenAI wrapper failures."""


class OpenAITimeoutError(OpenAIError):
    """Raised when an OpenAI call exceeds the specified timeout."""


# ---- Client (lazy, explicit key) ----

_client: Optional[OpenAI] = None

def get_client() -> OpenAI:
    """
    Lazily instantiate the OpenAI client so we don't capture an unset/placeholder key
    at import time. Fail fast if OPENAI_API_KEY is missing.
    """
    global _client
    if _client is None:
        api_key = os.environ["OPENAI_API_KEY"]  # fail fast; no placeholders
        _client = OpenAI(api_key=api_key)
    return _client


# ---- Timeout runner ----

def call_with_timeout(fn: Callable[[], Any], timeout: int = 60, name: str = "openai") -> Any:
    """
    Run a blocking callable in a worker thread with a timeout.
    Useful because the OpenAI SDK calls are blocking.

    Args:
        fn: Callable with no args that performs the OpenAI call.
        timeout: Seconds to wait before raising OpenAITimeoutError.

    Returns:
        Any: Result of fn().

    Raises:
        OpenAITimeoutError: if it times out.
        OpenAIError: for other failures.
    """
    try:
        with ThreadPoolExecutor(max_workers=1) as ex:
            future = ex.submit(fn)
            return future.result(timeout=timeout)
    except FuturesTimeoutError as e:
        logger.warning("%s call timed out after %ss", name, timeout)
        raise OpenAITimeoutError(f"{name} call timed out after {timeout}s") from e
    except KeyError as e:
        # Missing env var: OPENAI_API_KEY
        raise OpenAIError("OPENAI_API_KEY is not set in the environment.") from e
    except Exception as e:
        raise OpenAIError(str(e)) from e


# ---- Convenience helpers (optional, but handy) ----

def transcribe_audio_file(file_path: str, model: str = "whisper-1", timeout: int = 120) -> Any:
    """
    Transcribe audio using the OpenAI SDK with a timeout.
    Returns the SDK response object (often has .text).
    """
    def _call() -> Any:
        with open(file_path, "rb") as f:
            return get_client().audio.transcriptions.create(
                model=model,
                file=f,
            )

    return call_with_timeout(_call, timeout=timeout)


def chat_completion(
    messages: list[dict[str, str]],
    model: str,
    max_tokens: int = 500,
    timeout: int = 60,
    **kwargs: Any,
) -> Any:
    """
    Create a chat completion with a timeout.

    messages example:
      [{"role":"system","content":"..."},{"role":"user","content":"..."}]
    """
    def _call() -> Any:
        return get_client().chat.completions.create(
            model=model,
            messages=messages,
            max_tokens=max_tokens,
            **kwargs,
        )

    return call_with_timeout(_call, timeout=timeout)
