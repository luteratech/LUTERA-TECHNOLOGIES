# What Lutera backs up

Automatic primary backups run **every Monday at 08:00 Africa/Lagos** (07:00 UTC),
a seven-day interval. Vercel runs the backup independently of daily reminder
processing. Manual **Run backup now** remains available; a successful copy for
the same UTC day is reused rather than duplicated. A manual run does not move
the weekly calendar. Hosting cron timing can vary within the provider's window;
this is not a second-accurate execution promise.

The company Drive script is prepared for **Monday around 10:00 Africa/Lagos**,
allowing for the hosting schedule window and backup processing time.
Its one-time Google authorization must be completed by **luteratech2@gmail.com**
before unattended Drive copies can run. A connected chat Drive account is not
an unattended application identity. Review the actual Drive receipt, not just
whether connection settings exist.

Each run is a full encrypted **application snapshot**, not an incremental copy
of only changed records. The same encrypted file is copied to Drive. Both the
application records and the file manifest are collected by the database backup
function, with actual private file bytes added before encryption.

| Included | Details |
| --- | --- |
| Customers and sales | Customers, contacts, enquiries, follow-ups/opportunities, quotes, commercial documents/lines, orders, invoices, credits, receipts/payment records and allocations |
| Finance | Manual payment evidence records, expenses, supplier payments, refunds, bank-import/matching records, cost allocations, supplier bank details and approval decisions |
| Accounting | Chart of accounts, draft/posted journals, period controls, owner accounting/tax setup, opening confirmation, signatures and retained approval/source snapshots |
| Procurement and stock | Suppliers, offers, purchases, shipments, inspections, stock movements, reservations, quarantine/holds, locations, assets and order progress/cancellations |
| Projects and support | Cases/projects, tasks, notes, service checklists/templates, scope changes, response calendars/events, maintenance visits and customer acceptance requests |
| Website and administration | Saved website drafts, published content and publication records; company settings, staff/profile records, role memberships, business grants, responsibilities, operating policy and audit history |
| Communication and portal | Saved message/outbox records and statement snapshots; portal memberships, shares, events, case sharing and evidence records |
| Numbering and retry safety | Document counters, business/operations request histories and other saved idempotency records used to avoid duplicate processing |
| Actual uploaded private files | All objects present in work-evidence, work-staff, work-avatars and work-portal-evidence: payment/support evidence, staff photographs, avatars and portal uploads |

The 2 November manual backup contained **zero uploaded private files** because
those buckets had no file objects at that time. This does not mean future uploads
are excluded; the next snapshot enumerates those four buckets again. Document
records were still included. Generated PDFs, receipts and cards can be recreated
from retained records and the versioned export code; a file saved only to a
person's computer is not uploaded into the backup automatically.

## Excluded and kept separately

- Supabase Auth passwords/password hashes, MFA secrets, active sessions, login
  links and Auth identities. Membership/profile records are included, but actual
  authentication accounts require separate provider-level recovery and identity
  mapping. Restored access stays disabled until reviewed.
- Hosting/environment secrets: mail/API credentials, deploy hooks, cron/job
  secrets, Google authorization tokens, backup encryption keys and the private
  entry setting. Store recovery credentials separately in the company password
  manager, never alongside the Drive archives.
- Database schema/functions/RLS/migrations, source code, logos, templates, fonts
  and other repository assets. These are versioned in GitHub; preserve repository
  and provider configuration recovery separately.
- Unsaved form edits, in-app notification history, files not uploaded to the
  application, and external content behind saved URLs (for example stock photos).
- A recursive copy of earlier archives inside work-backups or the Drive folder.
  Existing backups remain retained; no automatic deletion is enabled.

## Integrity, coverage limits and recovery

Archives use AES-256-GCM with a scrypt-derived key. Each primary run verifies
local authenticated decryption before recording success. File SHA-256 digests
are included; the Drive script checks the encrypted file digest before and after
copying and records only a matching receipt. Primary success and off-site success
are tracked separately; missing configuration or failed jobs return failure.

Current limits are **32 MB of serialized snapshot/file payload before outer
encryption** and **50,000 public-table records**. Exceeding a limit fails visibly,
not by silently omitting data. A streaming/provider backup is needed before the
business outgrows these bounds. Application snapshots do not replace a complete
Supabase database/Auth disaster-recovery service.

See [the operations runbook](business-workspace-operations.md#encrypted-backups-supabase-then-google-drive)
for isolated restore steps and [the company setup guide](lutera-backup-setup.md)
for Google authorization. The owner-triggered 2 November primary backup is
verified; this is not evidence that the next weekly timer or Drive trigger has
already executed.
