# Refactor Structure (Pre-WhisperX)

This document describes the modular structure put in place so that adding WhisperX and speaker diarization can be done without regressions.

## Backend

### Directory layout

- **`backend/services/`**
  - **`transcription_service.py`** – Public API for transcription. Calls `transcription.transcribe_audio_file()`. Swap implementation here for WhisperX.
  - **`summary_service.py`** – Public API for summarization. Calls `summarization.summarize_and_extract_actions()`.
  - **`process_service.py`** – Orchestrates the full pipeline: transcribe → translate → summarize → save. Holds `JOB_PROGRESS`, `run_process_job()`, `get_job_status()`, `translate_results_back()`.
  - Existing: `transcription.py`, `translation.py`, `summarization.py`, `export.py`, `qa_detection.py`, `openai_wrapper.py`.

- **`backend/models/`**
  - **`__init__.py`** – All SQLAlchemy models: `db`, `User`, `Meeting`, `Setting`, `ExportHistory`. Single place for schema.

- **`backend/routes/api.py`**
  - Thin routes only: validate input, call services, return JSON.
  - Every route uses try/except and returns consistent `{"error": "message"}` on failure.
  - Process: `POST /api/process` (async 202 + job_id or sync 200), `GET /api/process/status/<job_id>`.

### Async processing

- Upload with `progress_job_id` in form → backend returns **202** and runs the pipeline in a background thread.
- Frontend polls **GET /api/process/status/<job_id>** until `status === "completed"` or `"error"`.

## Frontend (React Native / Expo)

### API layer

- **`mobile_app/src/api/client.js`**
  - **`getBaseUrl()`** – Resolves backend URL (config or Expo host).
  - **`processAudio({ audioUri, jobId, agenda, userId, signal })`** – POST to `/api/process`.
  - **`getProcessStatus(jobId, signal)`** – GET `/api/process/status/<jobId>`.
  - **`translateContent({ summary, transcript, target_language })`** – POST `/api/translate_content`.
  - All return Promises; callers use `.catch()` and update global error state.

### Global error state

- **App.js**: `globalError`, `setGlobalError`. Banner at top when set; Dismiss clears it.
- **HomeScreen** (and any screen that calls API): receives `onGlobalError` and calls it in every `.catch()` so API failures surface in the banner.

### Components

- **`mobile_app/src/components/UploadZone.js`** – Home content: brand, “Record Meeting” / “Upload Recording”, Add Agenda, Add Materials, Meeting ID. Used on home when `!showLibraryDetail`.
- **`mobile_app/src/components/MeetingControls.js`** – Recording section in meeting details: play/pause, skip, progress bar, share. Used in the detail ScrollView.
- **`mobile_app/src/components/TranscriptView.js`** – Transcript section (Create/Replace, Translate, Share, preview). Ready to be wired in where the transcript block is rendered; same pattern as MeetingControls.

## Adding WhisperX / diarization

1. **Backend**: Implement or wrap WhisperX in `backend/services/transcription.py` (or a new module) and expose the same contract (e.g. `(text, language)` or a richer result with segments). Call it from **`transcription_service.py`** so routes stay unchanged.
2. **Process pipeline**: If diarization returns speaker segments, extend **`process_service.py`** and the API result shape (e.g. `result.transcript_segments`). Frontend can stay on current fields until you add UI for segments.
3. **Frontend**: No change required for existing flows; new fields can be consumed where needed.

Errors from new code will still go through the same try/except and `{"error": "..."}` responses, and the app will still show them via `onGlobalError` and the banner.
