# Privacy, Identity, and Compliance Decisions

_Last updated: 2026-02-13_

## Product stance (current stage)
- Local-only storage on device (no automatic uploads).
- Guest-first user model with later upgrade to authenticated accounts.
- Single-device user (no multi-profile switching).
- Manual export only (user-initiated).

## Identity layer decisions
- Guest ID stored in AsyncStorage.
- Everything is user-scoped (recordings, transcripts, summaries, settings, usage counts).
- Auth provider direction: Supabase (later), but **auth is deferred** until product fit.

## Usage gating
- Subscription prompt after **N recordings**.
- Usage counter stored locally with the guest user scope.

## Privacy/compliance posture (current stage)
- Simple privacy policy.
- Clear consent text before recording.
- Explicit “local-only” messaging in product UX.
- Manual export only (no background or automatic uploads).

## Open items (future)
- Decide when/where consent is shown (first launch vs each recording).
- Optional local data deletion flow in the app.
- Optional encryption-at-rest for local recordings/transcripts.
- Determine compliance upgrades (HIPAA/SOC2/GDPR) if enterprise demand requires it.

## Minimal privacy policy outline (draft)
Use this as the baseline policy for the current local-only stage.

1. **What data is collected**
	- Audio recordings created in the app
	- Transcripts and summaries generated on the device
	- Basic app settings and usage counts (local)

2. **Where data is stored**
	- All content stays on the user’s device by default
	- No automatic uploads or background sync

3. **Data sharing**
	- No sharing unless the user manually exports content
	- Manual export is user-initiated only

4. **Data retention**
	- Data remains on the device until the user deletes it
	- Uninstalling the app removes local data

5. **User control**
	- Users can delete recordings/transcripts from the app (planned)
	- Users control any export or sharing

6. **Contact**
	- Provide a support email for privacy questions

## Consent copy (draft)
Use one of these before recording begins.

**Short consent text**
“By recording, you confirm you have permission from all participants.”

**Expanded consent text**
“By starting a recording, you confirm that all participants have agreed to be recorded. Recordings are stored locally on your device unless you choose to export them.”
