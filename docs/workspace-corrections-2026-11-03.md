# Lutera workspace and public-site correction release

3 November 2026. Implements the approved correction review against `faed24b`.
The supplied external review was assessed against the actual site; working public
interactions were retained and unsupported company claims were not introduced.

## Correction register

| Review | Delivered correction |
| --- | --- |
| W01 | Shared lists distinguish an absent amount from zero; negative values and actual currencies remain visible. |
| W02 | Commercial tax inputs accept two decimal places, bounded to 0–100%; server basis-point validation remains authoritative. No company tax registration or default rate is inferred. |
| W03 | Secondary customer actions wrap in a labelled menu. Tablet toolbars have automatic height; phone and small-tablet record lists use compact cards. |
| W04 | The business-card selector states 85 × 55 mm, matching existing PDF trim, front/back and bleed exports. |
| W05 | Operational totals and follow-ups precede the department directory; permitted enquiry, approval, task and payment shortcuts sit together. |
| W06 | Sidebar and breadcrumbs remain primary navigation. Duplicate tool selectors, refresh controls and unrelated archive shortcuts were removed from shared tools. |
| W07 | Details use business labels, Lagos dates, currency/rates, readable linked names and separate technical references. Audit record links resolve the actual record type. |
| W08 | Linked pickers retain native single-select behaviour with an optional search panel, readable selected values, loading, no-match and retry states. |
| W09 | Remaining role, department-access, customer-import and bank-import drafts participate in in-app navigation guards. Failed saves retain edited data. No browser close/reload dialog is installed. |
| W10 | Customer merge/share/access tools sit under Customer actions. CSV import is collapsed with a template, file input and existing duplicate-review preview. |
| W11 | A contextual sales-document journey explains quotation → order → invoice → evidenced manual payment/receipt. Earlier document archives and immutable issued copies remain intact. |
| W12 | Commercial lines prioritise description, quantity, price and amount. Optional catalogue/milestone choices are disclosed separately; totals stay near the action. |
| W13 | Payment details show received, allocated, refunded and available amounts, with linked invoices. These are read-only summaries; existing approved mutations remain responsible for allocations/refunds. |
| W14 | Accounting source options show formatted currency amounts and human references instead of storage units. |
| W15 | Bank CSV preview shows date, reference, currency, received/paid-out amounts and duplicate status, including duplicate lines within one file. Exact-amount/currency payment candidates open the existing reviewed match form. Matching does not move money. |
| W16 | Financial reports hide obsolete figures while loading, reject stale responses, label the cutoff, format headings and distinguish errors from empty sections. |
| W17 | Procurement actions have task-specific names. Supplier offers compare quoted cost, shipping, lead time and supplied terms within the same RFQ and currency; missing warranty/duties are not invented. |
| W18 | Availability subtracts both reservations and quarantine. Item details show location balances and recent movement/equipment links within the user's existing access. |
| W19 | Case fields distinguish project scope, support issues and maintenance coverage; omitted fields retain existing values on save. Tasks/cases offer list, board and due-date views for the current results page. |
| W20 | Account/roles and departments/authority are connected by a guided access flow. Current department grants are shown before changes; sensitive signing/posting/closing rights remain separate. Invitations are explicitly distinguished from account approval. |
| W21 | Activity has actor/date/type filters, readable names and record links, Lagos timestamps, technical references, loading, retry and empty states. System maintenance remains honestly attributed. |
| W22 | cPanel uses photograph thumbnails and friendly icon labels. Keys/addresses are advanced and fixed after saving. Archiving removes a service from current listings while retaining its address as a non-indexable archive page. Publication history appears only in Preview & publishing. |
| W23 | Staff labels and card dimensions are corrected; My account has section links. Existing approved Navy/Paper card artwork, supplied logo and exports are preserved. |
| W24 | Portal document review identifies the organisation, version and current requested action; document-specific evidence states and project dates are clearer. Sharing, recipient checks and private evidence authorization remain unchanged. |
| W25 | Requested services use the shared multi-picker; roles and authority remain multi-select. Compound fields have accessible labels. Evidence messages name PDF/image formats and show the filename. |
| W26 | Compact empty states, collapsed imports, quieter headings, contained wide tables, compact responsive record cards and non-blocking notice surfaces reduce unnecessary scrolling. |

The task/calendar and supplier-comparison views cover the **current paginated
results**, and say so. Stock details show up to 20 recent movements and 20
customer equipment records; other authorized history remains in its existing
tools. These views do not claim to be complete company-wide calendars or stock
history exports. Report detail limits remain explicit.

## Public-site changes

- The essential-storage notice has one acknowledgement. No optional analytics or
  advertising is installed, so a fictitious optional-cookie choice is removed.
  Fresh entry/new tabs still show the notice; same-tab internal navigation and
  reloads retain its acknowledgement. Footer settings can reopen it.
- Obsolete form-provider verification text is removed from the thank-you route.
- Retention wording describes the actual pending policy and retention criteria;
  it does not invent statutory periods or transfer agreements.
- All eight active services retain equal prominence. Existing equipment tabs,
  process stages, responsive hero motion, contact routes and favicon remain.
- The founder profile, RC number, client evidence, testimonials and credentials
  are **pending company-supplied, approved facts**. No placeholder achievements
  are published.

## Verification boundaries

Automated verification uses synthetic business records and intercepted writes.
It covers zero/negative amounts, fractional tax, incomplete decimal editing,
manual evidence requirements, card/PDF/DOCX/image exports, approvals and access,
linked navigation, imports, report-response ordering, responsive widths and
WCAG checks on exercised states. The navigation inventory covers all 72 tools,
seven department views, Dashboard and My account.

Read-only production schema inspection verifies the new stock query columns;
a PostgreSQL-generated bank-import fingerprint is used as an independent
regression vector. New summary/reference endpoints use the existing authenticated
session/MFA guard and RLS-bound database client; no service-key bypass or schema
migration is introduced. Anonymous access is tested against the running app.

No company invoices, accounts, transactions, messages or backups are created by
the fixture checks. Passing these checks does not substitute for the owner's
pilot with representative company data or prove every future permission mix.

## Remaining operational readiness

These were separate operational dependencies in the review and are not reported
as completed by this UI release:

1. A company-controlled production malware-scanner endpoint and observation of
   its accepted/rejected upload paths. Existing configured scanning fails closed.
2. A separate hosted staging environment; local fixture/recovery checks are not
   a claim that hosted staging exists.
3. An observed unattended weekly primary backup **and matching verified Drive
   copy receipt**, plus an isolated end-to-end restore rehearsal using the
   company recovery procedure. A backup receipt is not itself a restore test.
4. Owner-approved retention/recovery targets and pending tax/company evidence.
   No retention interval, tax registration or spending limit is fabricated.

See [business operations](business-workspace-operations.md) and the
[expansion status](business-workspace-completion-status.md) for the existing
backup/scanning/recovery procedures. Weekly backup cadence, manual payment
recording with evidence, last-owner protections, multiple roles and independent
approval/posting/closing/signing authority are preserved.
