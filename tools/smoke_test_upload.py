#!/usr/bin/env python3
"""
Small smoke test uploader: upload an audio file to /api/process and wait
for the meeting JSON artifact to appear in the transcripts folder.

Usage: python3 tools/smoke_test_upload.py pge1.m4a --host http://127.0.0.1:8001 --timeout 600
"""
import argparse
import json
import os
import sys
import time
from pathlib import Path

try:
    import requests
except Exception:
    print("The 'requests' package is required. Install it in the venv.")
    sys.exit(2)


def main():
    p = argparse.ArgumentParser()
    p.add_argument("file", help="Audio file to upload")
    p.add_argument("--host", default="http://127.0.0.1:8001", help="Backend host")
    p.add_argument("--timeout", type=int, default=600, help="Timeout in seconds to wait for artifact")
    args = p.parse_args()

    filepath = Path(args.file)
    if not filepath.exists():
        print(f"File not found: {filepath}")
        sys.exit(3)

    url = args.host.rstrip("/") + "/api/process"
    print(f"Uploading {filepath} to {url} ...")

    # Use curl subprocess for upload to avoid requests read-timeout issues
    import subprocess

    try:
        cmd = [
            "curl",
            "-s",
            "-F",
            f"audio_file=@{filepath};type=audio/m4a",
            "-F",
            "user_id=1",
            url,
        ]
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=args.timeout + 30)
        out = proc.stdout
    except Exception as e:
        print("Upload error:", e)
        sys.exit(4)

    print(out[:2000])

    try:
        data = json.loads(out)
    except Exception:
        print("Failed to parse JSON response; aborting")
        sys.exit(5)

    meeting_id = data.get("meeting_id")
    if not meeting_id:
        print("No meeting_id returned; aborting")
        sys.exit(6)

    meeting_id = data.get("meeting_id")
    if not meeting_id:
        print("No meeting_id returned; aborting")
        sys.exit(6)

    # Wait for transcript artifact file
    transcripts_dir = Path(os.getenv("TRANSCRIPT_FOLDER", Path.cwd() / "transcripts"))
    target = transcripts_dir / f"{meeting_id}.json"
    print(f"Waiting for artifact: {target} (timeout {args.timeout}s)")

    start = time.time()
    while True:
        if target.exists():
            print("Artifact appeared:", target)
            try:
                print(target.read_text()[:2000])
            except Exception:
                pass
            sys.exit(0)

        if time.time() - start > args.timeout:
            print("Timed out waiting for artifact")
            sys.exit(7)

        time.sleep(1)


if __name__ == "__main__":
    main()
