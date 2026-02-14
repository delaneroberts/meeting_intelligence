#!/usr/bin/env bash
cd "$(dirname "$0")" && git add -A && git commit -m "Backup" && git push
