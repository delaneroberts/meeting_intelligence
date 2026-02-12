"""
Language detection and translation service.

Detects language of transcripts and translates to English if needed.
Uses GPT-4o-mini for language detection and translation.
"""

import json
import logging
import re
from openai import OpenAI

logger = logging.getLogger(__name__)

# Initialize OpenAI client
client = OpenAI()  # reads OPENAI_API_KEY from environment

# ISO 639-1 language codes for common languages
LANGUAGE_CODES = {
    'en': 'English',
    'es': 'Spanish',
    'fr': 'French',
    'de': 'German',
    'it': 'Italian',
    'pt': 'Portuguese',
    'ru': 'Russian',
    'ja': 'Japanese',
    'ko': 'Korean',
    'zh': 'Mandarin Chinese',
    'yue': 'Cantonese',
    'ar': 'Arabic',
    'hi': 'Hindi',
    'th': 'Thai',
    'vi': 'Vietnamese',
    'tr': 'Turkish',
    'pl': 'Polish',
    'nl': 'Dutch',
    'sv': 'Swedish',
    'da': 'Danish',
}


def _contains_cjk(text: str) -> bool:
    """Return True if text contains CJK characters."""
    if not text:
        return False
    return bool(re.search(r"[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]", text))


def detect_language(text: str) -> dict:
    """
    Detect the language of the given text.
    
    Args:
        text: Text to analyze (uses first 1000 chars)
    
    Returns:
        Dict with keys: detected_language, language_code, is_english
        
    Raises:
        Exception: On API error
    """
    if not text or not text.strip():
        logger.warning("Empty text provided for language detection")
        return {
            'detected_language': 'Unknown',
            'language_code': 'unknown',
            'is_english': False,
        }
    
    detection_prompt = f"""Analyze this text and respond with ONLY a JSON object (no other text):

{{
  "detected_language": "Language name (e.g., 'English', 'Spanish', 'French', 'Cantonese', 'Mandarin Chinese', etc.)",
  "language_code": "ISO 639-1 code (e.g., 'en', 'es', 'fr', 'yue', 'zh', etc.)",
  "is_english": true or false
}}

Text to analyze:
\"\"\"{text[:1000]}\"\"\"
"""
    
    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "user", "content": detection_prompt}
            ],
            temperature=0.0,
            max_tokens=200,
            response_format={"type": "json_object"},
        )
        
        response_text = (response.choices[0].message.content or "").strip()
        result = json.loads(response_text)
        
        logger.info(
            "Detected language: %s (code: %s, is_english: %s)",
            result.get('detected_language'),
            result.get('language_code'),
            result.get('is_english')
        )
        
        return result
        
    except json.JSONDecodeError as e:
        logger.warning("Failed to parse language detection response: %s", e)
        return {
            'detected_language': 'Unknown',
            'language_code': 'unknown',
            'is_english': False,
        }
    except Exception as e:
        logger.exception("Language detection API error: %s", e)
        raise


def translate_to_english(text: str, source_language: str) -> str:
    """
    Translate text to English.
    
    Args:
        text: Text to translate
        source_language: Name of source language (e.g., 'Spanish', 'French')
    
    Returns:
        Translated English text
        
    Raises:
        Exception: On API error
    """
    if not text or not text.strip():
        logger.warning("Empty text provided for translation")
        return ""
    
    translation_prompt = f"""Translate the following {source_language} text to English. 
Provide ONLY the English translation, word-for-word and complete, with no explanations or comments.

{source_language} text:
\"\"\"{text}\"\"\"

English translation:"""
    
    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "user", "content": translation_prompt}
            ],
            temperature=0.0,
            max_tokens=4096,  # Max allowed for full transcript
        )
        
        translated_text = (response.choices[0].message.content or "").strip()
        
        if translated_text:
            logger.info(
                "Successfully translated %s text to English (%d chars -> %d chars)",
                source_language,
                len(text),
                len(translated_text)
            )
            return translated_text
        else:
            logger.warning("Translation returned empty text")
            return text
            
    except Exception as e:
        logger.exception("Translation API error: %s", e)
        raise


def detect_and_translate_if_needed(text: str, source_language: str = "") -> tuple[str, str, bool]:
    """
    Detect language and translate to English if needed.

    This is the main entry point for language handling.

    Args:
        text: Text to process (transcript or summary)
        source_language: Optional hint about source language (Whisper code or name)

    Returns:
        Tuple of (processed_text, detected_language_name, was_translated)

        - If text is already English, returns (original_text, 'English', False)
        - If text is non-English, returns (translated_text, language_name, True)
        - On error, returns (original_text, 'Unknown', False)
    """
    if not text or not text.strip():
        return text, "Unknown", False

    normalized_source = (source_language or "").strip().lower().replace("_", "-")
    if "-" in normalized_source:
        normalized_source = normalized_source.split("-")[0]
    if normalized_source:
        language_name = LANGUAGE_CODES.get(normalized_source)
        if not language_name:
            for code, name in LANGUAGE_CODES.items():
                if normalized_source == name.lower():
                    language_name = name
                    break

        if language_name:
            if language_name.lower() == "english" and _contains_cjk(text):
                logger.info("Text contains CJK characters; ignoring English source hint")
                language_name = None
            elif language_name and language_name.lower() == "english":
                logger.info("Source language hint indicates English, no translation needed")
                return text, language_name, False

            if language_name:
                logger.info("Source language hint: %s, translating to English", language_name)
                translated_text = translate_to_english(text, language_name)
                return translated_text, language_name, True

    try:
        # Detect language
        detection_result = detect_language(text)
        language_name = detection_result.get("detected_language", "Unknown")
        is_english = detection_result.get("is_english", False)

        # If detection failed, avoid translating to "Unknown"
        if language_name.lower() == "unknown":
            logger.warning("Language detection returned Unknown; skipping translation")
            return text, "Unknown", False

        # If already English, return as-is
        if is_english:
            logger.info("Text is already in English, no translation needed")
            return text, language_name, False

        # For non-English, translate to English
        logger.info("Text is in %s, translating to English", language_name)
        translated_text = translate_to_english(text, language_name)

        return translated_text, language_name, True

    except Exception as e:
        logger.exception(
            "Error during language detection/translation: %s. Returning original text.", e
        )
        return text, "Unknown", False


def translate_text(text: str, target_language: str) -> str:
    """
    Translate text to a specific target language.
    
    Args:
        text: Text to translate
        target_language: Target language name (e.g., 'Spanish', 'French')
    
    Returns:
        Translated text
        
    Raises:
        Exception: On API error
    """
    if not text or not text.strip():
        return ""

    if not target_language or target_language.lower() == "unknown":
        return text
    
    prompt = f"""Translate the following text to {target_language}. 
Only provide the translated text, nothing else.

Text:
{text}"""
    
    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.0,
            max_tokens=4096,
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        logger.exception("Translation error: %s", e)
        raise
