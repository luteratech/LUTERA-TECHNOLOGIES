# Activate Lutera's daily Drive backup copies

Use **luteratech2@gmail.com** throughout. The private company backup folder is:
https://drive.google.com/drive/folders/1M5R-up413YeEzlRudOPObu2f258gkktD

The encrypted 23 October snapshot has been copied to this folder and its
SHA-256 verified after download. A new manual primary backup succeeded on
**2 November 2026 at 15:20 UTC** in Supabase; its Drive copy is still pending.
This does not verify unattended daily execution. Supabase remains primary.

1. In the private Lutera workspace, open **Operations settings**. Choose
   **Run backup now** and review the result and latest primary backup date.
   If it fails, resolve that failure before relying on the schedule.
2. Download **Drive connection**. Download **Recovery key** separately and keep
   that key in the company password manager. Do not place either download in
   this Drive folder, chat, GitHub or the script source.
3. In a browser signed in as **luteratech2@gmail.com**, open
   https://script.google.com and create **Lutera backup copies**.
4. Paste the source from **Lutera-backup-drive.gs** in the backup folder (also
   versioned at `docs/backup-drive.gs` in the repository).
5. In Apps Script → Project settings → Script properties, add
   `LUTERA_BACKUP_URL` and `LUTERA_BACKUP_TOKEN` using the downloaded connection
   JSON. Keep these values out of source code and execution logs.
6. Select **installLuteraBackup**, run once and approve the requested Google
   Drive/external-request permissions with the company account. Do not approve
   an unfamiliar app or a different script. This copies pending encrypted files
   and installs the daily copy trigger around **09:00 Africa/Lagos**.
7. Check Apps Script → Triggers and Executions. Confirm a new encrypted file is
   in the company folder and **Operations settings** has a matching complete
   backup/Drive receipt. Verify the following scheduled day as well. A primary
   status alone means the Drive copy remains outstanding.

Primary snapshots are scheduled at **08:00 Africa/Lagos**. Reminder-email
failure no longer suppresses the independent primary backup attempt. Both
schedules still require actual successful execution and freshness checks.

The copy script verifies SHA-256 before and after storage, retries by exact
filename, and records only a matching receipt. No automatic deletion is enabled.
The encryption key stays separate from Drive. Chat's connected Drive profile
allows authorized file operations but does not grant an unattended Apps Script
execution identity; the one-time company-account authorization is still needed.

A successful copy is not a disaster-recovery drill. See
`docs/business-workspace-operations.md` for coverage, limits and isolated restore
steps. Application snapshots do not include Auth passwords/MFA/provider secrets.
