# Owner-confirmed accounting setup

The owner can save an accounting cutover, annual financial year-end and a
confirmed zero opening position under Administration → Owner tax & accounting
setup. Tax registration remains pending independently of ledger activation.

The first reporting period starts on the accounting cutover and ends at the
selected annual year-end. Later reporting years follow that calendar. Financial
reports default to the current reporting year, bounded by the cutover. A real
annual month/day is required; a leap-only February 29 year-end is rejected.
The year-end is locked after posting, so a later change needs a reviewed process.
A calendar boundary does not automatically close the books or post entries.

A zero-opening confirmation records no opening receivables, payables, deposits,
loans, stock or fixed assets. It does not create synthetic zero-value journals.
Future stock/assets and other transactions use their real dates and supporting
records. Existing journals and numbering sequences are not reset.

Bank name, account name and number stay private in Company document settings,
where the owner can edit them later. Actual banking values are not seeded in
migrations or stored in this repository. Issued document snapshots retain their
original details; later documents use the settings in effect when issued.

Payment terms are entered on each transaction as agreed with the customer.
Due dates have no fixed default. Existing quotation, invoice, receipt and
purchase numbering sequences remain in use. The owner handles approvals
initially; membership roles, department approval grants and signing authority
can be delegated separately when staff are added. No thresholds are invented.

Privileged setup changes use a clearly marked database-management audit actor,
not an invented staff/MFA session. Sensitive bank/tax/currency management changes
require the real `postgres` connection identity, no selected application role and
no staff JWT. A SECURITY DEFINER's effective user alone grants no such authority.
Every such management change writes its own system audit record. Application roles still pass the existing
membership, MFA and row-level access checks. Calendar validation applies to
both the application API and direct setup RPCs. Read-only capabilities expose
only the nonsensitive reporting calendar, not company tax or bank details.

Verification: strict types/build, fiscal date boundary checks, database access
and calendar validation, audit provenance, post-entry year-end lock, encrypted
restore, and browser layout/accessibility fixtures. Actual company setup is
saved separately through the authorized management connection and read back.
