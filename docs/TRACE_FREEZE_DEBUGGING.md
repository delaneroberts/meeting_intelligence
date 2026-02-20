## Trace collection and UI-freeze debugging (Expo Go)

Summary
-------
This document captures the instrumentation, steps, and lessons we used while diagnosing an Expo Go UI freeze that occurred when saving a picked audio file. It was created from the debug session that added on-device traces, a backend trace upload route, and UI mitigations. Keep this file with the repo so we can refer back during restores or further debugging.

Last-known-good commit
----------------------
- Commit: 28ea0332
- Ref / message: "Backup: commit all backend and mobile app changes before refactor"

If you want a quick restore to the baseline before the debug changes, create a restore branch from that SHA:

```bash
cd /Users/delaneroberts/meeting_intelligence
git checkout -b restore-28ea0332 28ea0332
```

What we added during debugging
------------------------------
- On-device tracing utility: `mobile_app/src/utils/trace.js` — writes timestamped trace events to device storage.
- Client-side trace dump and upload: instrumented `AudioFileScreen.js` and `HomeScreen.js` to write trace events around persist operations and POST the trace to the backend in a fire-and-forget fashion.
- Backend debug endpoint: POST `/api/internal/debug/trace` in `backend/routes/api.py` that writes request bodies to `/tmp/device-trace-<device>-<ts>.txt` for later inspection.
- Temporary UI mitigations: deferred FlatList updates, minimal row rendering, and runtime flags to disable risky initializations while reproducing.
- A smoke-test helper: `tools/smoke_test_upload.py` to upload a repo audio file and confirm transcript production.

Where traces and evidence are stored
-----------------------------------
- Device-side trace file path: created on-device by the trace util (on Expo FileSystem Documents). The client reads and posts this content on save.
- Backend receive location: `/tmp/device-trace-<device>-<ts>.txt` (on the dev machine where the backend runs). Check `/tmp` on the dev host for posted traces.
- Metro logs: we also configured the app to print a preview and full trace to Metro (check `/tmp/metro.log` or the packager terminal output).

How to reproduce the capture flow (quick)
---------------------------------------
1. Start backend (from project root):

```bash
cd /Users/delaneroberts/meeting_intelligence
./start_backend.sh
```

2. Start Expo/Metro for the mobile app (LAN or tunnel):

```bash
cd /Users/delaneroberts/meeting_intelligence/mobile_app
REACT_NATIVE_PACKAGER_HOSTNAME=10.0.0.65 npx expo start --lan -c
# or: npx expo start --tunnel
```

3. On device in Expo Go, reproduce: pick an audio file from library and save it.

4. Immediately watch Metro and backend logs for the persist lifecycle and trace upload:

```bash
tail -n 200 -F /tmp/metro.log
tail -n 200 -F /tmp/backend.log    # or check your backend terminal output
ls -1 /tmp/device-trace-*.txt     # check for uploaded traces
```

5. If a trace appears in `/tmp`, copy it locally and inspect. The trace contains timestamped events like `[persist] start`, `fileInfo`, `copyAsync:done`, `[persist] completed`, and any additional traces we wrote in `HomeScreen`/`AudioFileScreen`.

Lessons learned (concise)
------------------------
- When USB/syslogs aren't available, on-device trace files + a backend upload endpoint are an effective fallback to capture pre-freeze evidence.
- UI freezes can be caused by native initialization work performed when new FlatList rows render. Minimizing per-row native work (or deferring heavy init) reduces freeze risk.
- Print a compact preview of long traces to Metro first (so you get immediate evidence) then upload the full trace file in the background.
- Always create a WIP branch before large, invasive debug changes. We created branch `wip/debug-save-<ts>` and committed the debug work so it can be safely reverted.
- Use a small smoke-test audio file and a reasonably long request timeout when validating end-to-end processing locally; transient network/packager issues can otherwise make runs look flaky.

Next steps / safe restore options
-------------------------------
1. If you want a fast baseline restore: create a branch from the last-known-good commit shown above and run the smoke test and unit tests there.
2. If you prefer a surgical rollback: revert or drop the debug commits that touch the following files (review each diff first):
   - `mobile_app/src/utils/trace.js`
   - `mobile_app/src/screens/AudioFileScreen.js`
   - `mobile_app/src/screens/HomeScreen.js`
   - `backend/routes/api.py` (debug trace endpoint)
   - `tools/smoke_test_upload.py` (helper)
3. After restore, run `pytest -q` and `python tools/smoke_test_upload.py ./pge1.m4a --host http://127.0.0.1:8001 --timeout 600` to confirm baseline behavior.

Contact
-------
If anything in this doc looks out of date or you want a minimal PR that reverts only the debug bits, tell me which strategy you prefer and I'll prepare the branch/PR.

---
Generated: automatic summary from the recent debug session.
