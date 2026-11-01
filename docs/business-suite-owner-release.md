# Owner-operated accounting and electronic approvals

1 November 2026. This is a new implementation milestone, not a declaration that
every business-suite expansion item or statutory tax obligation is complete.

## Owner settings and deferred tax records

Administration → **Owner tax & accounting setup** stores company Tax ID,
registration number, VAT status, effective date, supporting reference and notes.
All start blank/unconfirmed. Save as **Pending — complete later** until ready.
Pending does not mean exempt. No company tax classification or opening balance
is invented. Public-site registration-number preferences remain separate.

New sales-invoice issuance requires an owner-confirmed tax profile applicable to
the document date. Charging VAT requires registered status and the supported
7.5% standard rate; zero VAT for a registered company requires an explanation.
The gate does not establish legal tax status or implement every exemption/tax.
The profile is frozen in the issued snapshot; history is not recalculated.
Quotations and pro formas remain distinct from sales/tax invoices.

Ledger posting starts disabled. Select an accounting start date and review
opening bank, customer, supplier, deposit, inventory and owner balances before
activation. Do not both import earlier transactions and include them in opening
balances. The start date is locked after activation. No real balances are seeded.

Explicit **Owner self-approval** supports the current one-person company. It is
recorded honestly. Turn it off and delegate independent authority as staff join.

## User management and responsibilities

**User access** approves membership and base roles. **Staff** starts without
website or legacy finance access. **Business permissions** assigns department
grants, record scope and editing/approval rights, plus job titles, duties and
separate journal-posting, period-closing and document-signing authority.
Underlying record access remains necessary. Owner authority is preserved; a
user cannot change their own membership through this editor or remove the last
active owner. Approving membership does not claim an Auth invitation was sent:
the existing verified-provider onboarding remains required, with MFA for staff.

## Accounting books

Finance → **Accounting books** contains the chart of accounts, draft journals,
balanced posting, immutable posted entries, correcting reversals, source imports,
general ledger, trial balance, period profit/loss, cumulative balance-sheet
figures, classified cash movement and period closing/reopening. Ledger and trial
balance have protected CSV downloads. Currencies are reported separately.

Business sources enter as drafts for review. Invoices record revenue and
receivables; customer payments record bank and deposits; allocation settles
receivables. Receipts are not imported again as sales. Refunds follow the
existing unallocated-payment rules. Bills need review of their expense/asset
account. Account 1000 is clearing: configure actual bank/cash accounts and
appropriate classifications before posting.

Source imports are idempotent while their journal is active; after reversal an
eligible source can produce a new reviewed event. Posting rejects stale source
drafts. Closing rejects outstanding drafts, missing eligible source postings
and unresolved source changes. Bank-match/version metadata alone is not an
accounting change. Posted journals are corrected through dated reversals.

Reports include posted entries only. This release does not automatically
consolidate currencies, depreciate assets, value stock movements, calculate all
Nigerian tax regimes or submit returns. Review/record appropriate adjustments;
those automation modules remain expansion work.

## Signature profiles and approved documents

Use **My account → My signing profile** (also an owner Administration shortcut).
Upload a personal PNG/JPEG under 200 KB; the server reconstructs a bounded PNG.
Users can manage/apply only their own signature.

**Document signatures** lets an authorised user review an issued/approved
revision, enter a private reason, explicitly consent and verify a fresh MFA code.
Signing is rate-limited. The database binds it to both the reviewed revision and
source fingerprint. Records retain signer, capacity, image, timestamp, actor,
reason and source snapshot. Profile updates preserve earlier approvals;
changed/voided documents do not inherit old signatures. New document preparers
come from authenticated identity, not assignment. Unknown history is not given
invented authorship.

PDF exports show the signature on the document and an approval-record appendix.
DOCX/PNG copies show the visible approval/reference. Authorised outbox and
customer-portal PDF copies include the current-revision approval. Customer
copies exclude private approval reasons and actor identifiers. Company approval
and customer acceptance are distinct; a company user cannot sign for a customer.

This is authenticated **electronic approval**, not certificate-backed/X.509 PDF
signing or a guarantee of legal enforceability for every transaction. A separate
certificate/provider is required for certificate-verifiable PDFs. NRS fiscal
validation/IRNs are separate from company approval signatures.

## Backups, verification and remaining work

New setup, responsibility, signature, account, journal and period tables are
included in encrypted manual/scheduled snapshots and isolated restore ordering.
The company Google Drive authorisation, scanner endpoint, persistent hosted
staging and approved operational recovery targets remain open setup items.

Checks cover types/build, calculations and export formats, role/MFA/RLS denials,
balanced immutable journals, period locks/reversals, source duplication, signature
binding/history, backup recovery and responsive/browser accessibility. Tests use
synthetic isolated records; no real customer emails or fake live invoices.

Next milestones are verified tax configuration and remaining applicable tax/NRS
integrations; optional certificate-backed signing; procurement requests/matching;
project boards/timesheets/budgets; automated inventory valuation/depreciation;
owner-led acceptance and reconciled opening balances; outstanding operational
backup/scanning/staging/recovery setup.
