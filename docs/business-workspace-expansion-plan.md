# Lutera business workspace expansion — implementation plan

**Prepared:** 22 October 2026
**Company:** Lutera Technology Ltd
**Status:** Implementation release prepared on 23 October 2026. See [business-workspace-operations.md](business-workspace-operations.md) for implemented workflows, verification and the remaining owner/provider configuration. A plan document alone is not deployment evidence.

**Scope update — 2 November 2026:** The owner subsequently authorized full internal
accounting. The owner/accounting release extends the initial CSV-only scope;
see [business-suite-owner-release.md](business-suite-owner-release.md) and
[accounting-readiness-information-checklist.md](accounting-readiness-information-checklist.md).
The initial-scope exclusions below describe the original release, not a ban on
that later work. Nigerian tax records remain pending until supplied.
**Baseline reviewed:** repository commit `b4d43f6`, workspace source and deployment runbook. Provider settings and real operational records were not re-audited for this planning exercise.

## 1. Intended outcome

Expand the existing private workspace into a connected system for Lutera's commercial and operational work. Equipment supply, procurement and computer-lab installations must have the same standing as consultancy, AI, software, data, cloud and systems-integration services.

The central business journey is:

**Enquiry → customer/opportunity → quotation → acceptance → sales order → purchasing and/or project delivery → sales invoice → payment → after-sales support.**

Invoicing and payment do not always happen after delivery. The system must support agreed deposits, staged billing, partial deliveries and milestone payments without forcing every job through an identical sequence.

Success means staff enter information once, can find the next action and its owner, and can trace every financial or delivery decision back to its source. The aim is a practical operations system; full statutory accounting, payroll and a general-purpose ERP are outside the initial scope.

## 2. Existing baseline and boundaries

| Available today | Expansion required |
| --- | --- |
| Approved accounts, mandatory authenticator MFA, account profiles, password controls and distributed authentication limits | Module-specific capabilities, assignments and approval workflows |
| Website draft editing, explicit publication, publication history and live revision checks | Verify/finish the public deployment-hook connection and owner publishing exercise |
| Quotations, pro forma invoices and payment receipts | Reusable customers, quote revisions, orders, final sales invoices, payment allocation, credit notes and refunds |
| Staff records, photographs, business cards and ID cards | Keep these tools; link staff to work assignments where appropriate |
| PDF, DOCX and PNG document exports | Extend templates to new document types with consistent identifiers and historical snapshots |
| Role-limited activity history and encrypted manual business-record backup | Searchable operational history, broader backup coverage, scheduled off-site backups and restoration testing |
| Public enquiries delivered through FormSubmit email | A durable, assigned workspace enquiry inbox and communication history |

Preserve the public site at `luteratech.com` and the private staff application at `workspace.luteratech.com`. Existing issued documents, document numbers, payment evidence, account permissions and company branding must survive the expansion unchanged.

The hidden entry URL remains supplementary. Authentication, authorization, MFA, database policies and private file access remain the actual protection. Do not introduce public registration for the staff workspace.

## 3. Proposed workspace navigation and experience

| Area | Main screens |
| --- | --- |
| Home | My work, business summary, approvals, overdue actions and recent activity |
| Customers & sales | Enquiries, customers, contacts, opportunities, quotations and sales orders |
| Finance | Sales invoices, payments, receipts, credit notes, refunds, expenses and statements |
| Procurement | Suppliers, supplier RFQs, comparisons, purchase orders and inbound deliveries |
| Equipment & delivery | Catalogue, locations, stock movements, reservations, serial numbers, deliveries and warranties |
| Projects & support | Projects, tasks, milestones, installation checklists, tickets and maintenance contracts |
| Team | Staff, cards and permitted assignments |
| Website | Existing content editing and publishing |
| Administration | Company settings, access, approval rules, audit, backups and integration health |
| My account | Existing profile, photo, email, password and authenticator management |

Design requirements:

- Retain the supplied Lutera identity, compact cards and restrained motion. Prioritize readable business information over decorative animation.
- Use searchable, paginated lists with filters and sort controls. Mobile lists become compact summaries with accessible detail views.
- Give customers, orders and projects a detail page with linked documents, status, assigned owner, activity and a clear next action.
- Distinguish lifecycle labels: an issued invoice can be unpaid or paid; an accepted quotation can still be awaiting fulfilment.
- Add shareable internal deep links while preserving the private entry boundary and authorization. A copied link never grants access.
- Keep required actions and status understandable without relying on color. Include loading, empty, validation, conflict, retry and permission-denied states.
- Preserve unsaved-change warnings. Retry actions must not issue duplicate documents, payments or messages.
- Use UTC timestamps in storage and Africa/Lagos for default business display. Store invoice/due dates as calendar dates, not ambiguous midnight conversions.

## 4. Delivery sequence and dependencies

Each release is independently usable, reviewed and deployed. A release is complete only when its acceptance checks and rollback preparations pass.

| Release | Scope | Depends on | Usable outcome |
| --- | --- | --- | --- |
| R0 | Operational readiness and shared foundations | Existing workspace | Safe environment for expansion and a verified recovery path |
| R1 | Customers, contacts, enquiries, opportunities and initial dashboard | R0 | Every enquiry has a record, owner and follow-up |
| R2 | Quote-to-order, final invoicing, payments and statements | R1 | A complete customer sales and collection workflow |
| R3A | Suppliers, procurement, stock, deliveries and warranties | R2 | Equipment jobs can be sourced, received and delivered with traceability |
| R3B | Projects, tasks, installations, support and maintenance | R2 | Digital and installation services can be delivered and supported |
| R4 | Expenses, supplier balances, reconciliation and management reporting | R2; relevant R3 records | Commercial reporting across sales, spending and delivery |
| R5 | Tracked communication, automation, customer portal and accounting integration | Stable R2–R4 workflows | Less manual follow-up and controlled customer self-service |

R3A and R3B share customer/order foundations but have distinct workflows. Plan both in the programme; choose their deployment order according to actual workload so digital services do not become an indefinite follow-up.

Do not assign firm delivery dates before the R0 inventory and the acceptance criteria are sized. Confirm the scope and effort of the next release at each release boundary. Provider subscriptions require separate cost review before selection. The owner selected accountant CSV exports and explicitly excluded a payment gateway; payments remain manual with uploaded evidence.

## 5. R0 — operational readiness and shared foundations

### Work packages

1. Reconcile the runbook with current deployment settings. Record which launch follow-ups remain open rather than repeating steps already completed.
2. Verify the website deploy hook, if still missing. Test draft → preview → publication request → exact live revision, including an unavailable build service. A save must never be presented as a live publication.
3. Exercise owner login, MFA, profile, document creation/export, staff-card export and sign-out through the deployed application. Use an approved test fixture; do not create fake financial records in the real issued-document archive.
4. Establish a separate staging database/storage environment with synthetic data. Preview builds must not receive production credentials or customer data.
5. Create a capability registry and permission checks shared by navigation, API actions and database policies. Keep the existing roles compatible while new module grants are introduced.
6. Introduce shared record IDs, reference conventions, assignment links, pagination/filter contracts, version conflict handling and mutation idempotency keys.
7. Add private attachment handling with size/type limits, generated object names, malware-check/quarantine arrangements, audited access and short-lived authorized downloads. Accept only the formats needed by each workflow; never serve active uploads inline from the application origin.
8. Establish integration/job health, structured error monitoring and request identifiers. Do not log passwords, tokens, financial attachments or unnecessary customer details.
9. Define backup coverage for the database and all private buckets, including account avatars. Choose company-controlled off-site storage, encryption, access, retention and failure alerts.
10. Restore a backup into an isolated environment and validate record links, files, document counters and access policies. Keep backup credentials separate from application credentials.

### Acceptance checks

- Existing account, document, export, staff-card and website tests remain green.
- A pre-MFA session, revoked user, unauthorized role and cross-origin mutation cannot access protected records or files.
- Restore evidence includes restored private files and counters, not only a successfully downloaded backup.
- Proposed recovery targets are documented: recovery point within 24 hours and recovery within one working day, subject to provider capability and owner agreement. They are targets, not current guarantees.
- Failed publication, missing configuration and failed backup jobs are visible and actionable.

## 6. R1 — customers, enquiries and sales opportunities

### Work packages

1. **Customer directory:** organizations and individual customers; legal/display names; contacts; billing and delivery addresses; optional tax identifier; sector; tags; assigned relationship owner; active/archived status.
2. **Contact records:** allow several contacts per organization with roles such as procurement, accounts or technical lead. A contact email must not automatically create a staff or portal account.
3. **Enquiry inbox:** reference, source, received time, requested services/equipment, message, authorized attachments, owner, priority, next action and due date.
4. **Pipeline:** new → acknowledged → qualified → quoting → won/lost/closed. Keep qualification and commercial outcome separate from whether an email was delivered. Capture loss reasons and reopen history.
5. **Opportunity records:** link one customer to one potential deal, service categories, optional estimated value/currency, expected close date and linked quotes. Do not count a prospect's estimate as revenue.
6. **Website ingestion:** introduce a validated server endpoint that durably stores an enquiry before confirming receipt. Add request limits, bot protection, payload bounds and duplicate-request handling. Send staff notifications through an outbox after persistence.
7. **Delivery transition:** retain current FormSubmit delivery until the new endpoint and notification path are proven. Switch one public form at a time, keep rollback available and avoid sending the same notification twice. Do not rely on an unauthenticated inbound email to execute business actions.
8. **History and follow-up:** internal notes, follow-up tasks, communication records, assignment changes, overdue markers and an audit trail. Internal notes never appear on customer-facing output.
9. **Customer import:** validate CSV with dry-run preview, duplicate suggestions and per-row errors. Offer reviewed merges; preserve linked documents and issued snapshots. Never merge solely because two contacts share a name.
10. **Initial dashboard:** enquiries needing replies, unassigned enquiries, follow-ups due, pipeline counts and assigned work. Filter by date, owner and service category.

### Acceptance checks

- An enquiry from every public form appears once in the workspace with a reference and source; notification failure does not lose the stored record.
- A network retry creates no duplicate enquiry. A genuine second request from the same person remains possible.
- Staff can assign an enquiry, link/create a customer, record a follow-up and create a quotation with prefilled details.
- A customer edit changes future drafts only; it does not rewrite issued quotations or receipts.
- Spam rejection, rate limits, invalid attachments and provider failures show appropriate public/private notices without exposing implementation details.
- Full-archive search and pagination work beyond the initial page. Duplicate merges preserve associations and audit history.

## 7. R2 — quotations, orders, invoicing and collections

### Work packages

1. **Product/service catalogue:** reusable equipment and service items with SKU/reference, description, unit, active status and suggested price/currency. An item may be stock-managed, purchased to order or a service; prices are suggestions, not automatic contractual commitments.
2. **Quotation revisions:** validity date, lead times, scope/exclusions and commercial terms. Copy a quote into a new revision linked to its predecessor. Issued revisions remain immutable; the accepted revision is explicit.
3. **Acceptance:** staff record who accepted, when and supporting evidence. Staff-recorded acceptance is distinct from later customer-portal acceptance; neither is described as a certified electronic signature.
4. **Sales orders:** convert an accepted revision to an order with its own frozen line/price snapshot, delivery destination, scope and responsible staff. Allow equipment and services on the same order.
5. **Fulfilment and changes:** track quantities ordered, reserved, delivered and cancelled independently from billing/payment. Changes after acceptance require an approved change record; do not silently edit agreed values.
6. **Final sales invoices:** add invoice numbering, order/customer references, issue/due dates, line items, approved tax configuration and payment terms. Support staged/partial billing without billing the same order quantity or milestone twice.
7. **Payment register:** record confirmed amount, currency, payment date, method, reference, recorder and evidence. Track bank-reconciled status separately. Generate a receipt from the recorded payment; never treat the receipt as a second cash transaction.
8. **Allocations and deposits:** allocate one payment across compatible invoices; support multiple payments against an invoice. Hold pre-invoice deposits as customer credit until allocated. Allocations must not exceed either the payment's available amount or the invoice's outstanding balance.
9. **Legacy receipts:** design and validate a one-time reconciliation map for existing quotation/pro-forma receipts. Preserve their source and identifier; carry the same payment forward without counting it again. Flag ambiguous cases for finance review.
10. **Corrections:** implement credit notes against issued invoices, approved payment-allocation reversals and separately recorded refunds. Preserve originals and reason/history. Never delete an issued financial record or allow a credit/refund above the eligible amount.
11. **Customer statements:** opening balance, invoices, credits, allocated/unallocated payments, refunds and closing balance for a selected date range, separately by currency.
12. **Exports:** branded PDF, DOCX and PNG for appropriate new document types, with readable multi-page output. Long PNG exports may be separate page images; do not silently truncate them. Retain historical document snapshots and template version references.
13. **Dashboard expansion:** quote decisions, accepted-order value, invoiced sales, money received, outstanding balances and overdue invoices. Do not label quotation value, deposits or invoiced totals as accounting-recognized revenue.

### Lifecycle and calculation rules

| Record | Proposed lifecycle |
| --- | --- |
| Quotation revision | Draft → issued; commercial outcome separately pending, accepted, declined, expired or superseded |
| Sales order | Draft → approved → in progress → fulfilled/closed; reasoned cancellation/change where allowed |
| Invoice | Draft → issued; settlement derived as unpaid, part-paid, paid or credited; overdue derived from due date and positive balance |
| Payment | Draft → confirmed → reconciliation status; corrections through controlled reversal/refund records |
| Credit note | Draft → issued → application history; cannot exceed remaining creditable value |

Use integer minor units and explicit currency precision, deterministic rounding, and database transactions for issue, allocation, reversal and numbering. Currency is fixed after issuance. No cross-currency allocation or combined multi-currency total without an explicit approved exchange-rate workflow.

Issued sales invoices should normally be corrected through credit notes. Any legally required cancellation mechanism must be confirmed with the company's accountant; the existing quote/pro-forma void behavior is not automatically appropriate for every new financial document.

### Acceptance checks

- Customer → revised quote → acceptance → order → staged invoice → partial payment → receipt → statement works without retyping customer details.
- A deposit paid against a legacy pro forma reduces the later invoice correctly and is counted as cash exactly once.
- Concurrent allocation attempts cannot overpay an invoice or spend the same payment twice. Retried issuance preserves one document number.
- Partial credits, refunds and cancelled order balances reconcile. Existing issued-document amounts, identifiers and exports remain unchanged.
- Dashboard figures match an independently checked fixture set containing deposits, partial payments, credits, refunds and multiple currencies.
- No VAT rate, tax identifier, RC number, bank account or statutory compliance claim is invented. An accountant reviews production financial templates and treatment before operational use.

## 8. R3A — suppliers, purchasing, inventory and equipment delivery

### Work packages

1. **Supplier records:** contacts, supplied categories, currency, lead times, warranty terms and separately controlled payment details. Sensitive bank-detail changes require review and audit.
2. **Supplier requests and comparison:** issue supplier RFQs, record responses, compare price, lead time, shipping, inspection and warranty terms. Record why an offer was selected; cheapest is not automatically preferred.
3. **Purchase orders:** approved supplier, source order/project, quantities, agreed costs, delivery terms, approver and attachments. Add threshold-based purchasing approvals and change history.
4. **Inbound fulfilment:** track ordered, shipped, partially received, rejected and returned quantities. Record pre-shipment inspection evidence, receiving checks and discrepancies.
5. **Operational landed cost:** record shipping, insurance and other approved costs with an explicit allocation basis. Keep cost estimates distinct from posted supplier bills and accounting valuation. FX conversion requires a stored rate/source/date; no silent live-rate rewriting.
6. **Stock records:** locations, stock-managed items, unit of measure, serialized equipment and an append-only movement ledger. Distinguish goods on order, on hand, reserved, available, quarantined and customer-owned equipment.
7. **Reservations:** allocate available units to approved sales orders. Lock competing reservations to prevent overselling. Do not receive stock merely because a purchase order is approved.
8. **Delivery:** packing list/delivery note, partial quantities, serials, delivery address, receiver, evidence and acceptance. Dispatch/hand-over transactions drive stock changes; a financial receipt does not.
9. **Returns and adjustments:** reference original receipt/delivery, reason, inspection outcome and approval. Correct stock with reversing movements instead of editing history. Prevent duplicate active serials and unauthorized negative stock.
10. **Customer equipment and warranty:** connect delivered serials to customer, site, installation/acceptance date, supplier terms and support history. Support Lutera's agreed site-acceptance warranty start where contractually applicable; do not start it automatically at quotation creation.

### Acceptance checks

- An accepted equipment order can produce a purchase order, two partial receipts, a reservation and two deliveries with consistent quantities and serials.
- Simultaneous reservations cannot allocate the same unit twice. A failed dispatch transaction leaves no partial stock movement.
- Rejected goods remain unavailable. Returns and approved adjustments reconcile to the movement ledger.
- Delivery notes omit internal supplier cost/margin information. Warehouse access does not grant bank-detail or finance access.
- Warranty and installed-asset records link to the actual delivered equipment and acceptance evidence.

## 9. R3B — projects, installation work and support

### Work packages

1. **Project records:** customer, originating order, site, service categories, project lead, scope, start/target dates and status. Keep a direct link to commercial terms.
2. **Milestones and tasks:** responsible person, priority, dependencies, due date, completion checklist, comments and private attachments. Include a list view; a board is optional, not the only interface.
3. **Service templates:** initial templates for AI/automation, software, consulting, cloud/data/integration, equipment installation and computer labs. Templates guide work without prescribing identical technical delivery for every client.
4. **Installation acceptance:** site readiness, equipment/serial checks, commissioning, hand-over documents, training and named customer sign-off. Pending installation must not be treated as completed delivery.
5. **Change control:** scope/price/date change requests, approval evidence and link to an order amendment or revised billing milestone.
6. **Support desk:** ticket reference, customer/project/asset, category, impact, assigned engineer, response due date, resolution and reopening history.
7. **Service commitments:** configurable working calendar, agreed response targets, escalation and pause reasons. Use only commitments Lutera actually offers; never infer a 24/7 support promise.
8. **Maintenance contracts:** covered assets/services, term, renewal date, visits and agreed support coverage. Generate renewal reminders; later recurring invoice generation follows the commercial rules in R2.

### Acceptance checks

- A software/AI engagement and a lab installation can each run from an order through milestones and customer acceptance.
- An engineer sees assigned work and authorized customer information without gaining unrestricted financial access.
- Accepted billable milestones become eligible for invoicing once; task completion alone cannot issue an invoice.
- A support ticket links to its asset/project and warranty, records response times, escalates correctly and retains its history when reopened.
- Contract renewal reminders respect the agreed business calendar and do not send duplicate messages.

## 10. R4 — expenses, reconciliation and management reports

### Work packages

1. Record supplier bills and expenses with supplier, category, currency, due date, cost center/order/project and evidence. Keep purchase commitments separate from actual bills.
2. Record supplier payments and allocations with the same concurrency, evidence and correction principles used for customer payments.
3. Add approved expense and refund workflows; do not initiate a bank transfer merely because an expense is approved.
4. Add bank-statement CSV import with preview, masked sensitive fields, duplicate protection and explicit staff-approved matching. An unmatched statement line is not automatically a receipt.
5. Produce receivables/payables ageing, overdue balances, spending by category, procurement commitments and project/order cost and margin estimates. Explain treatment of deposits, unpaid bills and allocated costs.
6. Add filtered CSV exports for the accountant, with stable IDs, currency, document numbers, reversals and mapping documentation. Sanitize cells against spreadsheet formula injection.
7. Add management dashboards for sales, cash collection, delivery, projects and support. Every figure must have a date definition, currency and drill-down to source records.

### Acceptance checks

- Receivables and payables tie back to issued documents, posted bills, credits and payment allocations for the same cutoff date.
- Reimporting a bank file does not duplicate transactions; ambiguous matches require review.
- Estimated project margin is clearly distinguished from statutory profit. Different currencies are not added without a defined conversion basis.
- Accountant exports reconcile to the workspace records and contain no unrelated private data.

## 11. R5 — communication, automation, portal and integrations

### Work packages

1. **Business email:** send approved quotes, invoices, statements and delivery documents from an authenticated company sender. Use the supplied logo and official name. Keep business communication separate from Supabase account/security email templates.
2. **Delivery tracking:** store message ID, recipient, linked record and queued/sent/failed/bounced states. Email provider acceptance does not mean the customer read or accepted a quote. Do not enable invasive tracking by default.
3. **Automation:** configurable follow-up reminders, due/overdue invoice reminders, approval requests, delivery notices, warranty/maintenance renewal prompts and internal escalation.
4. **Outbox jobs:** commit the business event and pending notification together; process asynchronously with idempotency keys, bounded retries, backoff, failure queues and manual replay. Verify inbound provider webhook signatures and deduplicate events.
5. **Approval-aware dispatch:** sensitive outgoing documents require the configured approval. Recheck cancellation, current permissions and reminder eligibility before sending. Allow jobs to be paused and recipients reviewed.
6. **Customer portal:** a separate customer authentication and authorization boundary with company/contact membership. Customers see only explicitly shared records for their organization, never staff navigation, internal notes, margins, supplier costs or private staff files.
7. **Portal actions:** view/download approved documents, accept/decline a specific quote revision, provide requested acceptance evidence, view permitted project milestones and raise tickets. Record actor, time and exact document version.
8. **Accountant handoff — confirmed:** use accountant CSV exports with stable IDs, document references, currencies, minor-unit amounts and reversal records. No external accounting provider is connected in this release.
9. **Payment boundary — confirmed:** do not add a payment gateway, payment links, automatic bank feeds or automatic transfers. Authorized staff enter confirmed payments and upload evidence. Supplier payments and refunds also require evidence. Additional messaging/calendar integrations would need separate scope.

### Acceptance checks

- Retried jobs and replayed webhooks do not send duplicate documents or create duplicate payments.
- Failed/bounced messages are visible to staff. Automated reminders stop after payment, closure or approved suppression.
- One customer's account cannot enumerate or download another customer's records, including through changed IDs, search, exports or file links.
- A withdrawn/superseded quote cannot be newly accepted; simultaneous staff/customer actions resolve consistently.
- Accounting synchronization can be stopped and replayed without duplicate postings. Export-based operation remains available during integration outages.

## 12. Proposed data model and transaction boundaries

These are logical entities, not final SQL names. New structured records should reference existing workspace documents and staff rather than replace their history.

| Domain | Main entities and relationships |
| --- | --- |
| Customer relationships | Customers → contacts/addresses; enquiries → customer/opportunity; notes and follow-ups reference their parent |
| Commercial | Catalogue items → quote/order lines; quote revision → acceptance → sales order; invoice lines reference order lines or milestones |
| Money | Payments → allocations → invoices; receipts reference payments; credits/refunds reference the original financial events |
| Procurement | Suppliers → supplier RFQs/offers → purchase orders/lines → goods receipts/lines and supplier bills |
| Equipment | Locations, serials, movements and reservations reference item/order/receiving/delivery records |
| Delivery/support | Deliveries and acceptance → installed assets/warranties → support tickets and maintenance contracts |
| Service delivery | Projects → milestones/tasks/change requests; staff assignments reference approved members and permitted staff profiles |
| Shared operations | Attachments, approval requests/decisions, business events, notifications/outbox jobs and integration mappings |
| External access | Portal memberships explicitly relate a separate customer identity to permitted customer organizations |

Implementation rules:

- Use stable UUIDs internally; human references have transactional counters and cannot serve as access secrets.
- Store identity relationships and money in typed columns with constraints. Use bounded, versioned JSON only for snapshots or genuinely variable metadata.
- Freeze customer/company/line/terms snapshots on issuance. Later directory edits cannot change historical documents.
- Prevent orphan records with foreign keys. Archive referenced master data; restrict hard deletion to eligible drafts or unreferenced records.
- Use version checks for editable records and row locks/unique constraints for issue, payment allocation, reservations, receiving and dispatch.
- Separate draft/issued status from settlement, fulfilment and delivery-email status. Derive balances and availability from controlled underlying events.
- Dashboard/search data must respect the same row and field permissions as the underlying records, including direct API requests.
- Keep normalized currency precision and rounding rules in one contract. Scope initial operational currencies explicitly; do not imply every currency has two decimal places.
- For background jobs, use a narrowly scoped worker identity and explicit job functions. Do not fabricate MFA claims or weaken staff AAL2 policies to run scheduled tasks.
- Keep final authorization on the server and in Postgres. Fix privileged helper search paths, restrict execute grants and keep definer helpers outside exposed schemas.

## 13. Access and approval design

Retain current owner/admin/editor/finance/designer behavior until a deliberate capability migration. Add sales, procurement, warehouse, project and support capabilities without granting them implicitly through an unrelated existing role.

| Responsibility | Default proposed access |
| --- | --- |
| Owner | Company configuration, access grants, approval policy, business oversight, backups and audited exceptional actions |
| Administrator | Operational administration expressly granted by owner; no automatic permission to change bank details or bypass financial approvals |
| Sales | Assigned/permitted customers, enquiries, opportunities, quotes and orders; approved document sharing |
| Finance | Invoices, confirmed payments, allocations, credits, statements, bills and permitted financial reports |
| Procurement | Suppliers, offers and purchase requests/orders within granted scope; sensitive supplier payment changes restricted |
| Warehouse | Receiving, stock, serials, dispatch and delivery; no bank information or unrestricted margins |
| Project/support | Assigned projects, tasks, authorized client contacts, tickets and service assets |
| Editor/designer | Existing website/staff-card capabilities; no new automatic access to customer finance |

Define read, create, edit, issue, approve, void/reverse, export, assign and settings capabilities independently where needed. Customer visibility can be all authorized records or assigned records according to the owner's policy; default to the narrower scope for new operational roles.

Configure approval thresholds for purchases, discounts, credits, refunds and sensitive bank-detail changes before enabling the corresponding action. Requester and approver should be different people. For a one-person operation, permit only an explicitly configured, reasoned and audited owner exception; never silently mark it independently approved. Submitted approval contents are versioned, and material edits invalidate prior approval.

## 14. Existing-data migration and compatibility

1. Inventory existing real records without copying personal/financial content into Git, chat or fixtures. Record counts and reconciliation totals securely.
2. Take and verify a database plus private-file backup before production migrations.
3. Apply additive tables/columns and backward-compatible code first. Preserve `work_documents`, numbering and export behavior while new links are optional.
4. Suggest customer records from existing document details. Finance/sales review ambiguous names, shared email addresses and addresses before linking; do not rewrite historical snapshots.
5. Map each existing issued receipt to a single underlying payment representation. Maintain legacy source links and prove that legacy/new views cannot double-count it.
6. Backfill in bounded, resumable, idempotent batches. Reconcile totals by currency and compare document counters before enabling new transactions.
7. Enable one module for pilot users. Broaden access only after live operational checks and sample outputs pass.
8. Remove compatibility paths only after a documented reconciliation and retention window; never renumber historical documents.

Migration rollback normally means disabling the new feature and returning to compatible code. Do not roll a database back to an old snapshot after legitimate new transactions unless writes are stopped and those transactions have been accounted for in a recovery procedure.

## 15. Verification, release and operating standards

| Test layer | Required coverage |
| --- | --- |
| Contracts and calculations | Money, rounding, quantities, due dates, state transitions, approval thresholds and schema validation |
| Database integration | MFA/role/assignment policies, direct API denial, immutable records, numbering, payment/stock concurrency and idempotent migrations |
| Files and exports | Private authorization, malformed upload rejection, untrusted names/content, multipage documents and snapshot accuracy |
| Browser workflows | Core customer/sales, equipment and digital-service journeys; errors/retries; small phone, tablet and desktop; keyboard and automated accessibility checks |
| Integrations | Notification failure, webhook signature/replay, outbox retries, deployment failure and paused accounting sync |
| Recovery | Database plus file restoration, counters, payment balances, stock ledger and restored access restrictions |
| Performance | Realistic seeded archive and pagination, indexed queries, concurrency under expected load, export limits and measured response times |

Agree the expected number of users, records and attachment sizes during R0, then set measurable performance budgets. Use synthetic scale fixtures; do not import production customer data into preview environments.

For each release: document schema changes, run existing and new checks, deploy staging, complete workflow acceptance, take production backup, deploy compatible migrations/code, enable the feature gradually, inspect runtime/queue health and record release evidence. No test should send real customer emails, charge a payment or issue a fake live invoice.

Recovery and onboarding procedures must cover lost MFA, departed staff, provider outage, integration secret rotation, failed publication, failed notifications and document-correction requests. Activity logs must be searchable with filters/pagination rather than limited to the latest 200 rows.

Define retention by record class with the owner/accountant: financial evidence, customer communications, staff files, security logs and backups have different needs. Support controlled deletion/anonymization where appropriate without destroying required financial history. Audit payloads must exclude secrets and unnecessary personal content.

## 16. Business rules to confirm during the relevant release

These are decision points, not requests for credentials. Implement defaults only where they do not create a financial or contractual commitment.

| Decision | Proposed starting direction | Needed by |
| --- | --- | --- |
| Service priorities | All current services remain visible and selectable | R1 |
| Customer access | Assigned records for new operational roles; owner-configured broader grants | R1 |
| Business dates/currency | Africa/Lagos, NGN initially; preserve existing document currencies | R1/R2 |
| Quote validity, deposit, invoice terms | Configurable approved company defaults, editable within authority | R2 |
| Taxes and invoice correction | Confirm with accountant; keep unprovided identifiers blank | R2 |
| Approval amounts and approvers | Owner defines policy; no invented spending/discount limits | R2/R3 |
| Stock locations/units/serial policy | Reflect actual storage and equipment; no fictional opening stock | R3A |
| Warranty/support calendar | Contract-specific coverage and agreed site-acceptance terms | R3 |
| Cost/FX/accounting treatment | Accountant-reviewed mapping and explicit rates | R3/R4 |
| Backup location/retention/recovery target | Supabase primary; Google Drive off-site, encrypted; retention awaits owner/accountant policy | R0 |
| Business email sender | Verified company sender with monitored reply destination | R1 notifications/R5 external sends |
| Accounting, payments, portal | Accountant CSV exports; manual evidenced payments; separate approved customer portal | R5 |

## 17. First implementation backlog

| ID | Deliverable | Dependency | Completion evidence |
| --- | --- | --- | --- |
| FND-01 | Current deployment/runbook reconciliation | None | Verified open/closed launch checklist |
| FND-02 | Isolated staging and synthetic seed | FND-01 | Preview cannot use production records |
| FND-03 | Database/file backup and isolated restore | FND-01 | Restore report with files, counts and counters |
| FND-04 | Capability and assignment contracts | FND-01 | Owner/editor/finance/new-role denial matrix passes |
| FND-05 | Shared pagination, idempotency, attachments and events | FND-02/04 | Retry/concurrency/access checks |
| CRM-01 | Customer/contact schema, API and directory | FND-04/05 | Create/search/archive/conflict tests |
| CRM-02 | Enquiries, assignments and follow-ups | CRM-01 | Inbox-to-customer workflow |
| CRM-03 | Durable public-form ingestion and notification outbox | CRM-02 | Exactly-once record creation and recoverable delivery failure |
| CRM-04 | Opportunities and linked quote creation | CRM-01/02 | Enquiry-to-quote browser scenario |
| CRM-05 | Customer import/merge and legacy-link preview | CRM-01 | Dry-run errors and preserved source links |
| CRM-06 | My work and first sales dashboard | CRM-02/04 | Role-scoped metrics match source records |
| SALES-01 | Catalogue and quote revision/acceptance | R1 | Immutable issued revisions and explicit acceptance |
| SALES-02 | Orders and staged final invoices | SALES-01 | Controlled conversion and no double billing |
| SALES-03 | Payment allocation and legacy receipt reconciliation | SALES-02 | Concurrent allocations/legacy deposit test |
| SALES-04 | Credits/refunds, statements and exports | SALES-03 | Reconciled end-to-end sales fixture |
| SALES-05 | Finance dashboard and R2 pilot | SALES-04 | Owner/finance acceptance and release report |

The later releases use the work packages and acceptance checks above as their backlog. Break those into code-sized tasks when their upstream contracts are stable; avoid creating a rigid detailed schedule around unvalidated interfaces.

## 18. Programme completion criteria

The expanded workspace is ready for routine business use when:

- An enquiry can be assigned and traced through a customer, accepted quotation and order without duplicate entry.
- Both equipment and digital-service jobs can be delivered, invoiced, paid and supported with linked evidence.
- Cash, outstanding invoices, credits, stock and operational reports reconcile to their source records.
- Staff see only their permitted work, and sensitive actions follow explicit approvals.
- Historical documents and existing account/export/website features remain intact.
- Communication failures and overdue work are visible rather than silently lost.
- Database and private-file recovery has been demonstrated, and operating responsibilities are documented.
- Customer self-service and accounting synchronization, if enabled, pass their separate access and reconciliation checks.

**Recommended first milestone:** complete R0, then ship the customer/enquiry inbox and quote handoff in R1. Build final invoicing and payments next. This establishes the shared foundation needed by every subsequent module.
