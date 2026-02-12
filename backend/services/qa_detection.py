"""
Question and answer detection service.

Automatically detects questions in meeting transcripts,
determines if they're rhetorical, and answers real questions
based on the meeting context.
"""

import json
import logging
from openai import OpenAI

logger = logging.getLogger(__name__)

# Initialize OpenAI client
client = OpenAI()  # reads OPENAI_API_KEY from environment


def detect_and_answer_questions(
    new_transcript: str,
    full_transcript: str = ""
) -> list[dict]:
    """
    Detect questions in a transcript snippet and answer real questions.
    
    Identifies questions, classifies them as rhetorical or real,
    and provides answers for real questions using full context.
    
    Args:
        new_transcript: New transcript snippet to analyze for questions
        full_transcript: Full meeting transcript for context (optional)
    
    Returns:
        List of question dictionaries with keys:
        - question: The exact question from transcript
        - is_rhetorical: Boolean indicating if rhetorical
        - answer: Answer to real questions, or note if rhetorical
        
    Raises:
        Exception: On API error
    """
    if not new_transcript or len(new_transcript) < 20:
        logger.info("Transcript snippet too short, skipping question detection")
        return []
    
    logger.info(
        "Detecting questions in %d char snippet (context: %d chars)",
        len(new_transcript),
        len(full_transcript or "")
    )
    
    detection_prompt = f"""Analyze this transcript snippet and identify any questions asked.

For each question found:
1. Extract the exact question (verbatim from the transcript)
2. Determine if it's a rhetorical question (asked for effect, not expecting answer) or a real question
3. If it's a real question, answer it based on the FULL meeting transcript so far

Respond with ONLY a JSON array (no other text):
[
  {{
    "question": "What was the deadline mentioned?",
    "is_rhetorical": false,
    "answer": "The deadline is March 15, 2026."
  }},
  {{
    "question": "Isn't that amazing?",
    "is_rhetorical": true,
    "answer": "This is marked as rhetorical and doesn't need an answer."
  }}
]

If no questions are found, return an empty array: []

New transcript snippet:
\"\"\"{new_transcript}\"\"\"

Full transcript context:
\"\"\"{full_transcript}\"\"\"
"""
    
    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "user", "content": detection_prompt}
            ],
            temperature=0.5,
            max_tokens=1000,
        )
        
        response_text = (response.choices[0].message.content or "").strip()
        
        try:
            questions = json.loads(response_text)
            if not isinstance(questions, list):
                logger.warning("Question detection returned non-list: %s", type(questions))
                return []
        except json.JSONDecodeError as e:
            logger.warning("Failed to parse question detection response: %s", e)
            return []
        
        logger.info("Detected %d questions", len(questions))
        return questions
        
    except Exception as e:
        logger.exception("Question detection API error: %s", e)
        raise


def auto_detect_qa(transcript: str) -> list[dict]:
    """
    Auto-detect Q&A patterns in a complete transcript.
    
    This is a simpler interface when you have the full transcript
    and don't need incremental detection.
    
    Args:
        transcript: Complete meeting transcript
    
    Returns:
        List of question dictionaries
    """
    return detect_and_answer_questions(
        new_transcript=transcript,
        full_transcript=transcript
    )
