# Business workspace implementation status

Updated 24 October 2026. Company: **Lutera Technology Ltd**.

This records the expansion delivered in the repository and the remaining
operational setup. It does not treat account authorization or company acceptance
as complete merely because the supporting code exists.

## Implemented application scope

| Plan area | Working capability |
| --- | --- |
| Shared foundations | Live membership/MFA checks, module grants, protected files, version conflicts, mutation idempotency, audit history, error references and encrypted backups. |
| Customers and enquiries | Customer/contact directory, legal names and tags, enquiry priority, attachments, assignment, next actions, follow-ups, imports/merges, pagination and owner/service/date filters. Public enquiries persist before notification. |
| Sales and collections | Quote revisions and acceptance, frozen orders, staged invoices, evidenced manual payments, numbered receipts, allocations, credits/refunds and branded document exports. Date/currency-specific statements have PDF/CSV export and a controlled email queue. |
| Purchasing and stock | Supplier offers and selection, approved purchases, inbound shipments, evidence-backed inspections, stock locations, quarantine/release, reservations, delivery, returns and serialized equipment/warranty records. |
| Delivery and support | Projects, tasks/dependencies, milestones, service checklists, acceptance, scope changes, support history, working-calendar response targets, evidenced clock pauses/resumption and maintenance visits. |
| Finance and management | Approved expenses with project/cost-centre links, manual supplier payments and evidenced corrections, reviewed supplier bank changes, incoming/outgoing bank matching, landed-cost allocation and dated management reports. Currency totals stay separate. |
| Communication and portal | Controlled outbox, message pause/review/retry, opt-in reminders, recipient/state checks at dispatch, owner-approved customer access, version-specific document sharing and private customer evidence uploads. |
| Responsive workspace | Collapsible sidebar on tablet/desktop; searchable hamburger dropdown on phones, Escape/outside-click dismissal, keyboard focus handling, compact forms/cards and contained scrolling for wide tables. |

Approval remains required. Optional owner-configured rules can add a named
approver or owner above a threshold; they never automatically approve spending.
No monetary thresholds were invented or seeded. Payments never use a gateway or
initiate a bank transaction. Accountant CSV exports remain the integration option.

## Using the additional controls

Open **Operational controls** and choose an operational area. Staff see only
areas covered by their grants; approval routing is owner-only. New records and
corrections require the relevant source IDs and, where applicable, evidence and a
reason. Existing business records display their IDs and can be linked to these
controls. Searches accept descriptions or an exact record ID.

- Use **Stock locations**, **Purchasing inspections**, **Stock quarantine** and
  **Inbound shipments** alongside the purchase/receiving workflow. Rejected
  inspections quarantine future receipts; explicitly hold any existing receipt
  that is also affected. An authorized release requires a reason.
- Use **Order quantity changes** for eligible undelivered/unbilled quantities;
  release reservations first. Use **Order fulfilment** to record acceptance and
  close work only after its completion checks pass.
- **Service response clocks** require recorded customer agreement evidence to
  pause/resume. Setting a ticket to waiting does not stop the clock.
- **Supplier payment details** masks account numbers in lists. An authorized
  finance approver can reveal details for review; that read is audited. Approval
  needs another colleague, or an explicit reasoned owner exception.
- **Outgoing bank matching** links an imported negative bank line to an already
  recorded supplier payment or refund. Unmatch before correcting a supplier
  payment. Importing or matching does not make a payment.
- **Customer acceptance requests** must reference an active shared issued
  document. The customer can upload PDF/photo evidence through their approved
  portal session. Staff review the result; it is not a certified e-signature.
- Open a customer for **Customer statement**. Select dates and currency before
  export or queuing email to a recorded contact. Queued statement snapshots stay
  private. Use **Management reports** for a Lagos-date cutoff.
- **Dispatch review & retries** can pause pending messages and safely retry
  eligible failures. Provider-accepted messages cannot be replayed as new mail.

## Verification and limits

Production schema migrations `20261024061746` and `20261024061834` are applied.
The completion workflow fixture also passed on the actual project inside a
rolled-back transaction, leaving no fixture members, customers or documents.
All public workspace tables have RLS; the security advisor reports only the
existing provider leaked-password setting described below. Performance advisory
output contains informational unused indexes on the new, currently empty data.

Validation includes strict TypeScript, a production Next.js build, 25 unit tests,
SQL access/workflow fixtures and an encrypted record restore into a fresh
database. A separate isolated Storage API exercise restores actual private file
bytes and checks SHA-256 hashes, references and anonymous-download denial.
Browser fixtures exercise phone/tablet/desktop layouts, navigation, forms,
exports and WCAG automated checks. These are synthetic tests; they do not
constitute a real signed-in company acceptance pilot or proof of every external
mail delivery. No fake issued production financial records or customer test
emails are required by these checks.

## Remaining owner/provider setup

1. **Google Drive:** install and authorize the company-account Apps Script trigger
   described in the [operations runbook](business-workspace-operations.md#encrypted-backups-supabase-then-google-drive).
   The user confirmed this is not installed. Supabase is the primary private
   encrypted backup destination; unattended Drive copies need this authorization.
2. **Website publishing hook:** confirmed present in the private project's
   production environment on 27 October. The contact/navigation release deploys
   with this setting. A signed-in draft → Publish → live-revision acceptance
   check remains part of the company pilot; saving is distinct from publication.
3. **Malware service:** the private ClamAV INSTREAM adapter is implemented and
   tested. A company-controlled scanner endpoint must be configured using
   `CLAMAV_HOST`, optional `CLAMAV_PORT` and `CLAMAV_TLS`. A configured scanner
   fails closed. Without it, type/size validation and file reconstruction remain
   active, but production malware scanning is not claimed.
4. **Supabase Auth:** enable [leaked-password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)
   if supported by the account plan. The provider advisor still reports it off.
5. **Company acceptance:** owner/accountant confirm tax/bank details, opening
   balances, initial stock, actual approval limits, service commitments, retention
   and recovery targets. Operations settings expose the relevant configuration;
   retention does not silently delete evidence. External reminders start disabled.
6. **Hosted staging:** isolated local database/Storage recovery testing is
   available. A persistent separate hosted staging project remains a provider
   decision; production credentials must not be given to untrusted previews.

These items prevent declaring the entire programme operationally signed off.
Payroll, statutory general-ledger accounting, bank transfers, payment gateways
and external accounting synchronization are outside the agreed scope.
