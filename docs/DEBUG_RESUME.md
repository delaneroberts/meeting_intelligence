Resume debug session after reboot
=================================

What this file is for
---------------------
Quick steps and artifacts to resume the trace/UI-freeze debugging session after you restart your Mac. It captures branch/commit info, where evidence is stored, and exact commands to run to reproduce and collect traces.

Current repository state
------------------------
- Restore branch checked out: `restore-28ea0332` (commit 28ea0332)
- Debug notes file present: `docs/TRACE_FREEZE_DEBUGGING.md` (kept intentionally)
- Recent transcript exists: `transcripts/20260218_124816_436.json`

Important paths
---------------
- Repo root: /Users/delaneroberts/meeting_intelligence
- Backend logs (recommended): /tmp/backend.log  (may be created by start script)
- Metro packager log: /tmp/metro.log
- Device traces upload location (on dev host): /tmp/device-trace-*.txt

Quick checklist to run after reboot
----------------------------------
1. Open a terminal and go to the repo:

```bash
cd /Users/delaneroberts/meeting_intelligence
```

2. Activate the venv (if you use one) and set PYTHONPATH so tests and server can import packages:

```bash
source .venv/bin/activate   # adjust if your venv is elsewhere
export PYTHONPATH=$PWD
```

3. Start backend (this will run `app.py` and write logs to /tmp/backend.log):

```bash
./start_backend.sh > /tmp/backend.log 2>&1 &
sleep 2
tail -n 200 -F /tmp/backend.log
```

4. Start Expo/Metro for the mobile app in a separate terminal if you need to reproduce on device:

```bash
cd mobile_app
REACT_NATIVE_PACKAGER_HOSTNAME=10.0.0.65 npx expo start --lan -c
# or: npx expo start --tunnel
```

5. Re-run the smoke test (keeps POST timeout long to allow OpenAI):

```bash
cd /Users/delaneroberts/meeting_intelligence
python3 tools/smoke_test_upload.py ./pge1.m4a --host http://127.0.0.1:8001 --timeout 600
```

6. While the smoke test runs, watch the backend log (in the terminal where you ran tail -F /tmp/backend.log) and Metro logs (/tmp/metro.log) to capture where it stalls.

Things to check if the smoke test hangs
--------------------------------------
- Backend responsiveness: curl http://127.0.0.1:8001/api/health (should return 200).
- If the backend is blocking during transcription/summarization, look for OpenAI API calls in `backend/services/transcription.py` and `backend/services/summarization.py` in the logs. Long delays usually indicate waiting on OpenAI responses.
- Confirm `OPENAI_API_KEY` is present in your environment if you expect live OpenAI calls.
- Check `/tmp/device-trace-*.txt` for uploaded device traces (if reproducing on device) and `/tmp/metro.log` for client-side trace dumps.

How to preserve collected evidence
---------------------------------
- Copy `/tmp/backend.log` and `/tmp/metro.log` to the repo or a safe folder before rebooting:

```bash
cp /tmp/backend.log ./logs/backend-log-$(date +%Y%m%d_%H%M%S).log
cp /tmp/metro.log  ./logs/metro-log-$(date +%Y%m%d_%H%M%S).log
ls -1 /tmp/device-trace-*.txt || true
```

If you want me to automate resume steps (start backend, tail logs, run smoke test) I created a helper script `tools/resume_smoke_test.sh` that runs the common sequence (see that file and run it after reboot).

Contact
-------
If anything here looks wrong, update the file and commit. When you're back up, tell me whether you want me to run the smoke test and tail logs for you.
