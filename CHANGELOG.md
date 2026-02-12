# Changelog

## 2026-02-12 — Phase 2 Frontend Refactor + UX Hardening

- Split `static/script.js` into modular JS files under `static/js`.
- Added safer JSON parsing and error handling.
- Added retry button for upload errors.
- Disabled translation controls until data is available.
- Display current language label in translation area.
- Added `/api/health` test coverage.
