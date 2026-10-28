# Lutera business workspace: release and operations

For the 24 October expansion, new controls, verification evidence and open
account setup, see [implementation status](business-workspace-completion-status.md).

Company: **Lutera Technology Ltd**. Public website: **https://luteratech.com**.
Staff use their existing private entry on **workspace.luteratech.com**. The root
and `/admin` deliberately remain unavailable. Customer access is separate at
**https://workspace.luteratech.com/portal**; only owner-approved customer emails
can receive a sign-in link.

## Business rules

- **No payment gateway or automatic bank transactions.** Customer payments,
  supplier payments and refunds are entered by authorized staff. Evidence is
  required. A customer payment issues one numbered receipt; allocation is a
  separate action. Reallocating a payment does not create more cash.
- Supported operational currencies are NGN, USD, GBP and EUR, each with two
  decimal places. CSV columns ending `_minor` use integer minor units. Reports
  keep currencies separate. A foreign-currency expense linked to an order needs
  the explicit exchange rate, date and reference. Contribution is an operational
  estimate, not statutory profit.
- Use **Export filtered CSV** for accountant handoff. No external accounting
  system is connected. Text is protected against spreadsheet formula injection;
  numeric columns remain usable as numbers, including negative amounts.
- Issued documents keep their original company/customer/price snapshots.
  Correct invoices with credit notes and traceable allocations/refunds. Drafts
  remain editable. Purchases, credits, refunds, discounts and unlinked sales
  orders require approval access. A creator cannot independently approve their
  own sensitive document; an owner exception requires a recorded reason.
- Only the owner can change bank, tax and default-currency settings. No bank,
  tax identifier or commercial response promise is invented by this release.
- New operational grants are explicit. Assignment scope is enforced in SQL,
  including direct API requests. Stock operations require an inventory grant
  covering the stock ledger. Existing editor/designer permissions do not grant
  customer finance access.

## Working journeys

1. **Customer / enquiry:** Business operations → Customers / Enquiries. Assign an
   owner and follow-up. Public forms now persist the enquiry before showing
   success, then queue an internal company notification. A mail outage does not
   discard the saved enquiry. CSV customer imports have a preview and duplicate
   checks; customer merges require review and disable portal memberships for
   renewed authorization.
2. **Sales:** open a customer → Prepare quotation → save and issue → record
   customer acceptance with evidence, or share it through the portal. Create a
   sales order from the accepted quotation. Agreed lines and totals must match;
   otherwise revise the agreement. Create invoices against source lines, reducing
   quantities for staged billing. Completed billable milestones can be linked
   once; completing a task never issues an invoice automatically.
3. **Collections:** Customer payments → New record → select the customer, amount,
   date/method/reference, upload evidence and explicitly confirm receipt. Allocate
   the payment to an invoice. Unallocated balances, partial payments, credits,
   refunds and corrected allocations remain traceable. Legacy receipts retain
   their original references and are represented once in cash totals.
4. **Procurement / stock:** record suppliers and offers, review landed charges
   and lead times, record a reasoned selection, then prepare/approve a purchase
   order. Receive against its lines. Reserve stock for an issued order and
   dispatch against an issued delivery note. Returns reference the original
   movement and cannot exceed its quantity. Serialized items need individual
   serials; warranty registration requires dispatched equipment.
5. **Delivery / support:** create a project, ticket or maintenance contract. Open
   Delivery and service controls and add the category checklist once. Assign
   tasks, dependencies, deadlines and customer-visible milestones. Installation
   completion requires the acceptance checklist, named customer acceptance and
   evidence. Tickets require a resolution before closure and retain reopening
   history. Waiting requires a reason; it does not silently stop a contractual
   clock. Agreed response targets use the owner-configured Lagos working calendar
   and holiday dates. Scope changes require approval and a linked revised order
   or milestone before application; issued documents are not silently edited.
6. **Expenses / reconciliation:** upload a bill, submit for approval, approve with
   a reason, then record the manually completed supplier payment with evidence.
   Bank CSV imports have preview and duplicate protection. Explicitly match a
   line to an already recorded payment; importing a bank file cannot issue a
   receipt or initiate payment.
7. **Communication / portal:** use recorded customer contacts, approved issued
   attachments and the monitored reply address `info@luteratech.com`. Messages
   have queued/provider-accepted/delivered/failed/bounced states. Delivery is not
   acceptance. Sender permissions, recipient membership, document state and
   reminder eligibility are checked again at dispatch. Revoked memberships and
   superseded quotations lose portal access. Only deliberately shared documents
   and project milestones appear in the portal; staff notes and supplier costs
   stay private. Shared documents have PDF download; quotes can be accepted or
   declined by the verified customer email.

Lists are searchable and paginated. Detail links can be copied for authorized
colleagues; possession of a link grants no access. Activity has archive pagination.
Default business dates and display timestamps use Africa/Lagos.

## Encrypted backups: Supabase, then Google Drive

The scheduled job runs daily at **08:00 Africa/Lagos**. Its encrypted application
snapshot includes business records, numbering counters, idempotency records and
private evidence, staff photographs and account avatars. It uploads to the
private **work-backups** Supabase bucket before recording a successful primary
copy. Failed copies remain visible in Operations settings. The worker never
fabricates a staff session or MFA claim.

Lutera's private Drive destination is:
https://drive.google.com/drive/folders/1W_idKvhJdpkaapikUcoErR_ErdUuKrVh

The encrypted pre-expansion snapshot was uploaded there and authenticated
decryption was checked before migration. The first full primary snapshot was
also uploaded to Supabase, copied to Drive, downloaded again, checked against
its SHA-256 digest and successfully decrypted before its copy receipt was
marked complete. There were no issued documents, staff
records or private staff/avatar objects in the pre-expansion inventory.

**One-time company Google authorization is still required for daily Drive
copies.** The chat's Google connector cannot supply an unattended Vercel identity.
A company-owned Apps Script provides this authorization without sharing the
backup encryption key with Google or placing credentials in source code:

1. Sign in through the existing private staff entry. Open **Operations settings**.
   Download **Drive connection** and **Recovery key**. Store the recovery key in
   the company password manager, separate from the backup folder. Do not post
   either file in chat or Git.
2. In the same Google account that owns the backup folder, open
   https://script.google.com and create a project named **Lutera backup copies**.
   Paste the code from [backup-drive.gs](backup-drive.gs).
3. Under Project settings → Script properties, add `LUTERA_BACKUP_URL` and
   `LUTERA_BACKUP_TOKEN` using the downloaded connection file. Keep these out of
   the script source and execution logs.
4. Select **installLuteraBackup**, run it and approve Google's Drive and external
   request permissions. This copies outstanding primary snapshots and installs a
   daily trigger around **09:00 Africa/Lagos**. Google may require an owner review
   of the private script before granting these permissions.
5. Confirm the encrypted file exists in the company folder and that Operations
   settings shows a **complete** backup with its Drive receipt. A **primary**
   status means the off-site copy is still outstanding. Failure emails from Apps
   Script go to its owning Google account; also review workspace backup health.

The copy process checks SHA-256 before and after writing Drive, reuses the exact
backup filename on retries and acknowledges only a matching snapshot digest.
No backup is automatically deleted until Lutera approves its retention policy.
The current application backup limit is **32 MB before outer encryption** and
50,000 public records; exceeding it fails visibly rather than truncating data.
Plan a streaming/provider backup before the business exceeds those limits.

An application snapshot does **not** back up Supabase Auth passwords, MFA
secrets, active sessions, login links, provider credentials or project schema.
Keep the versioned migrations and maintain the provider's database/Auth recovery
arrangements separately. Restore tests below cover business records and access
policies, not a provider-level Auth disaster recovery exercise.

## Recovery and rollout checks

- `npm run test:db` builds fresh disposable PostgreSQL databases with synthetic
  Auth identities. It tests finance/stock/permissions/portal/backup controls, then
  encrypts/decrypts a synthetic snapshot and restores it into a second database.
  All foreign keys are recreated and validated, record counts/counters reconcile,
  and restored staff/customer access stays disabled. Fixtures never issue real
  live documents or send emails.
- `scripts/verify-backup.ts` accepts its password on stdin and reports only
  metadata/counts. Scheduled snapshots also verify individual file checksums.
- For an isolated recovery, pass the password on stdin to
  `npx tsx scripts/restore-business.ts SNAPSHOT.lutera EMPTY_OUTPUT_DIRECTORY`.
  It writes private recovery SQL and checksum-verified bucket files, never
  connects to a database itself and requires an explicit isolated-restore marker.
  Recreate approved Auth identities or review their UUID mapping before import.
  Upload actual file bytes through Storage rather than inserting object metadata.
  Reconfigure secrets independently. Review every restored permission and enable
  access only after counts, counters, balances and file access are checked.
- Restore to a **fresh isolated target** first. Do not overwrite production from
  an old snapshot after new transactions. An incident rollback normally disables
  the new module and returns to compatible code while preserving new records.
- Preview UI tests use synthetic responses and a local database; preview builds
  do not receive the new production worker, mail or backup secrets.

## Verification record — 23 October 2026

- Applied production migrations `20261023192159`, `20261023192723` and
  `20261023193618`. The final guard permits one issued order per accepted
  quotation and serializes concurrent conversions.
- Actual-project business/access fixtures passed and rolled back.
- Strict types, 22 unit checks, full database/recovery suite and four private
  browser suites passed. Public packaging/content/interaction checks passed.
- Production dependency audit: zero reported vulnerabilities.
- Supabase security advisor: no new schema warnings; the existing leaked-password
  setting remains open. Performance checks no longer report unindexed foreign
  keys, repeated auth initplans or overlapping document SELECT policies.
- The Vercel production deployment is READY for both projects. Live checks
  confirm public routing, protected workspace/API denials, customer portal
  entry, signed-event rejection and the authorized encrypted-backup copy
  endpoint. The post-deployment error/fatal log scan returned no entries.
- A real signed-in owner business pilot remains separate from fixture tests.

## Department navigation

The private workspace opens on a task-oriented Dashboard. Its Lutera blue menu
groups existing tools into Sales & Customers, Finance, Procurement & Inventory,
Projects & Support, Website cPanel, Staff & Cards, and Administration. Select a
department to see its working steps and tools; the chevron expands its shortcuts.
Search the sidebar to find a task across departments, or search within a
department. Quick actions open the appropriate new-record form.

Finance includes manual customer payments with required evidence, receipt
generation, allocations, invoices, expenses, corrections and reconciliation.
Earlier standalone receipts remain in their archive. Website cPanel keeps draft
editing, preview, publication and live-revision checks together. Saving a draft
still does not publish it.

Department visibility follows existing role capabilities and explicit business
grants; moving a tool does not grant additional access. The owner configures
business record scopes and editing/approval rights under Administration →
Business permissions. The API and database continue to enforce authorization.

The sidebar closes with its own close button on tablet/desktop; a header menu
button reopens it. Phones use a searchable dropdown menu. Back/Forward arrows
remain above the page body, alongside breadcrumbs. Existing section/module URLs,
record restoration and unsaved-change guards remain supported.

## Remaining owner/provider configuration

- Install/authorize the company Drive trigger and retain the recovery key.
- `PUBLIC_SITE_DEPLOY_HOOK` is now present in the private project's Production
  environment. Verify a signed-in draft → Publish → live revision during the
  company acceptance pilot; environment presence alone does not prove the hook
  points to the intended project.
- Complete an owner-signed-in operational pilot with real approved company
  details, opening balances, stock locations and service commitments. Automated
  external invoice reminders start disabled until the owner enables them.
- Supabase's advisor still reports leaked-password protection disabled. Review
  that provider setting and plan eligibility; this release does not claim it was
  enabled.
- Agree backup/evidence retention with the owner/accountant. No third-party
  accounting synchronization, payment gateway, payroll or bank transfer is added.
