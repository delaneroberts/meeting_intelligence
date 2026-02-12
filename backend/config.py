"""
Configuration module for Meeting Assistant backend.

Centralized configuration for database, file paths, and constants.
"""

import os
from pathlib import Path

# Get the project root directory
PROJECT_ROOT = Path(__file__).parent.parent

# ----------------------------
# File Storage Configuration
# ----------------------------

UPLOAD_FOLDER = os.path.join(PROJECT_ROOT, "uploads")
TRANSCRIPT_FOLDER = os.path.join(PROJECT_ROOT, "transcripts")
LOG_FOLDER = os.path.join(PROJECT_ROOT, "logs")

# Create folders if they don't exist
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(TRANSCRIPT_FOLDER, exist_ok=True)
os.makedirs(LOG_FOLDER, exist_ok=True)

# ----------------------------
# File Management
# ----------------------------

MAX_FILE_AGE_SECONDS = 60 * 60  # 1 hour (auto-delete old files)
MAX_CONTENT_LENGTH = 25 * 1024 * 1024  # 25 MB (max upload size)

# ----------------------------
# Database Configuration
# ----------------------------

# SQLite (Phase 1)
# For Phase 3: can migrate to PostgreSQL
DATABASE_PATH = os.path.join(PROJECT_ROOT, "meeting_intelligence.db")
SQLALCHEMY_DATABASE_URI = f"sqlite:///{DATABASE_PATH}"
SQLALCHEMY_TRACK_MODIFICATIONS = False

# ----------------------------
# LLM Configuration
# ----------------------------

# Decision: GPT-4o-mini only (Phase 3: add others)
LLM_MODEL = os.getenv("LLM_MODEL", "gpt-4o-mini")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

# Verify API key is set
if not OPENAI_API_KEY:
    import logging
    logger = logging.getLogger(__name__)
    logger.warning("WARNING: OPENAI_API_KEY is not set in environment")

# ----------------------------
# Transcription Configuration
# ----------------------------

# Decision: Whisper only (Phase 3: add Deepgram/AssemblyAI)
TRANSCRIPTION_SERVICE = "whisper"
WHISPER_MODEL = "whisper-1"

# ----------------------------
# Default User (Phase 1)
# ----------------------------

DEFAULT_USER_ID = 1
DEFAULT_USER_NAME = "local_user"
DEFAULT_USER_EMAIL = "local@localhost"

# ----------------------------
# Logging Configuration
# ----------------------------

LOG_FORMAT = "%(asctime)s [%(levelname)s] %(name)s - %(message)s"
LOG_FILE = os.path.join(LOG_FOLDER, "app.log")
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")

# ----------------------------
# Flask Configuration
# ----------------------------

FLASK_ENV = os.getenv("FLASK_ENV", "development")
FLASK_DEBUG = FLASK_ENV == "development"
FLASK_PORT = int(os.getenv("FLASK_PORT", 8001))

# ----------------------------
# API Configuration
# ----------------------------

# Allow all origins for development
# Phase 3: restrict to specific origins
CORS_ORIGINS = ["*"]

# ----------------------------
# Feature Flags (Phase planning)
# ----------------------------

FEATURES = {
    "email_export": False,  # Phase 3
    "multi_user_auth": False,  # Phase 2
    "pwa_support": True,  # Phase 1
    "qa_detection": True,  # Phase 1
    "language_translation": True,  # Phase 1
    "structured_export": True,  # Phase 1
}
