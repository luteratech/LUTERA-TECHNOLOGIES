# Administration redesign — 3 November 2026

The owner approved the screenshot review and separation of daily operations,
backup/recovery, integrations and operating policy before implementation.

- Operations settings contains reminders and the working calendar. Both preserve
  unsaved edits during internal navigation and disable changes while saving.
- Backups & recovery consolidates full scheduled snapshots, status refresh,
  history, company-folder access, connection setup and recovery-key tools. The
  older password-protected records export remains under Recovery tools and is
  labelled separately from full business snapshots.
- Integrations shows named services, configuration status and message/enquiry
  counts. Configuration alone is not reported as successful execution. The
  missing attachment scanner remains explicitly visible.
- Retention & recovery policy contains the existing editable policy fields;
  saving does not activate deletion or change the backup cadence.
- The notification bell sits in the signed-in header, with one shared history
  panel, so it cannot cover mobile form controls.
- Raw health JSON, internal field labels, bare folder URLs, repeated setup prose
  and unrelated accounting commentary are removed from the default interface.
- The last successful primary and latest verified Drive copy remain distinguishable
  from the newest attempt. Green Drive status requires complete + a stored copy
  receipt. A failed primary does not imply that Drive was attempted. Status
  refresh errors retain older data with an explicit freshness warning.
- Approved Sora, JetBrains Mono figures, exact #2E5BFF sidebar, Paper canvas,
  white flat panels and token-based spacing, radii and status colours are used.
- No changes to roles, approval rules, backup encryption, schedule, retention,
  financial data or payment processing are part of this design release.

Reference patterns reviewed: Nielsen Norman Group progressive disclosure,
IBM Carbon notifications, W3C WCAG reflow/status messages, and the supplied
Lutera design system. Open Design generation is not claimed.

Verification: see the accompanying application tests and browser administration
fixtures, including data-state transitions, unsaved navigation, failures/retry,
keyboard controls, responsive widths and automated accessibility checks.

Local release checks passed: 43 unit tests, strict TypeScript, production build,
and all seven browser suites (core workspace, account email flows, account,
business operations, owner/accounting/signing, notifications and Administration).
Administration screens were inspected at phone and desktop sizes and checked at
320, 390, 768, 1024 and 1440 px with automated WCAG checks. All browser writes
used synthetic fixtures; no real financial records, emails or backup jobs were
created by these tests.
