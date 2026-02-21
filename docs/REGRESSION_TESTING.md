# Regression Testing

## Quick run (unit tests only)

From the project root:

```bash
python -m pytest tests/ -v --tb=short
```

Or use the script:

```bash
./tools/regression_test.sh
```

## What’s covered

### Backend (pytest)

| Test file | What it checks |
|-----------|----------------|
| `test_health_api.py` | GET `/api/health` returns 200 and `{"status": "ok"}` |
| `test_process_api.py` | POST `/api/process` without file → 400; unknown job status → 404; error responses include `error` |
| `test_settings_api.py` | GET/PUT `/api/settings` with DB |
| `test_models.py` | User, Setting model and get/set |
| `test_export.py` | save/load/delete meeting artifacts (JSON) |
| `test_translation.py` | Translation helpers (CJK, empty text) |

No OpenAI or network calls are made in these tests; they use a test app and temp dirs.

### Smoke test (optional, needs running backend)

With the backend running (e.g. `python app.py` or `./start_backend.sh`) and a short audio file:

```bash
./tools/regression_test.sh --smoke path/to/short.m4a
```

Or manually:

```bash
python tools/smoke_test_upload.py path/to/audio.m4a --host http://127.0.0.1:8001 --timeout 120
```

This uploads to `POST /api/process` (sync path), expects a JSON body with `meeting_id`, and waits for the meeting artifact file to appear under the transcript folder. Use a short clip to keep the run fast.

### Frontend

There is no automated frontend test suite yet. Manually:

1. Start backend and mobile app.
2. Open Library, upload a recording, confirm transcript/summary and rename.
3. Use Record flow and Save to Library.
4. Check that the global error banner appears when the backend is unreachable or returns an error.

## CI / pre-commit

To run only unit tests (no server, no audio):

```bash
pytest tests/ -v
```

You can add this to CI or a pre-commit hook. For full regression including smoke, run the backend in CI and then `./tools/regression_test.sh --smoke <fixture_audio>`.
