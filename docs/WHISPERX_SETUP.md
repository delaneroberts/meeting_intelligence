# WhisperX + speaker diarization

The pipeline uses **WhisperX** when the package is installed: transcribe → align (timestamps) → diarize (speakers) → then translate/summarize as before.

## Setup

1. **Install dependencies**

   ```bash
   pip install -r requirements.txt
   ```

   This pulls in `whisperx` (and torch, etc.). If you prefer to keep using only OpenAI Whisper, do not install whisperx; the app falls back to `transcribe()` (OpenAI).

2. **Mac GPU (MPS)**

   The code uses `device='mps'` and `compute_type='float16'`. If MPS is not available, it falls back to CPU.

3. **Hugging Face token (diarization)**

   Speaker diarization uses pyannote models on Hugging Face. You need:

   - A [Hugging Face account](https://huggingface.co/join).
   - Accept the conditions for [pyannote/speaker-diarization-3.1](https://huggingface.co/pyannote/speaker-diarization-3.1) (and the segmentation model it uses).
   - Create a [User Access Token](https://huggingface.co/settings/tokens) and set it in the environment.

   In the project root, create a `.env` file (or export in your shell):

   ```bash
   HF_TOKEN=hf_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```

   The app loads `.env` via `python-dotenv` when available. You can also set `HUGGING_FACE_HUB_TOKEN` instead of `HF_TOKEN`.

## Behaviour

- **With WhisperX installed**: `process_audio(file_path)` runs (transcribe → align → diarize). The async job returns `result.segments` as a list of `{"speaker": "SPEAKER_00", "start": 0.0, "end": 5.2, "text": "..."}`. The job status is set to `"completed"` when done (see `process_service.run_process_job`).
- **Without WhisperX**: The pipeline uses OpenAI Whisper only (`transcribe()`); no segments or speaker labels.
- If WhisperX runs but diarization fails (e.g. no token), the rest of the pipeline still runs; segments may have a default speaker.

## Model and performance

- Whisper model: `base` (change `model_name` in `transcription_service.process_audio()` for `large-v2` etc.).
- Diarization model: `pyannote/speaker-diarization-3.1` (requires HF token and model agreement).
