# Lutera private business workspace

Separate Next.js application for approved Lutera staff. The public website is
still built from the repository root; this app must use a separate Vercel project
with Root Directory **`apps/workspace`**.

The full [deployment and operating runbook](../../docs/private-workspace.md)
records account setup, security controls, publication configuration and launch
limitations. The owner email approved for initial access is
`chimaster010@gmail.com`. A membership row alone does not create a login.

```sh
npm ci
cp .env.example .env.local
# Set local values; generate WORKSPACE_ENTRY with openssl rand -hex 24.
# For development use WORKSPACE_ORIGIN=http://127.0.0.1:3000.
npm run dev
```

Open the exact generated path on that origin. `/` and `/admin` return 404.
Authentication, MFA and database permissions protect the API independently of
this path. No service-role key is needed or accepted by the app.

## Workspace navigation

The header has Back/Forward controls with unavailable directions disabled and a
breadcrumb linking to the overview. Section changes, business modules/records,
operational areas and document views use browser history on the existing private
route. Browser Back/Forward also restore these views; record access is checked
again by the existing authorized endpoints. Dirty forms ask before navigating.
Only route IDs and navigation counters are retained, never unsaved form values.

Close/collapse is on the sidebar itself. The header hamburger reopens a closed
sidebar or the phone menu; it never becomes an X. Escape closes the phone menu
and returns focus to the opener. Menus and controls retain 44px touch targets.

Checks:

```sh
npm run check
npm test
npm run test:db  # Docker, disposable PostgreSQL; no real emails or records
npm run build
```

The UI test uses `tests/browser.py`, a production server on port 3100 and local
`.env.local` settings. It checks real anonymous HTTP denials, then uses API
fixtures for UI flows. The database suite uses minimal Supabase Auth fixtures;
complete a real owner sign-in/MFA/export smoke check after deployment.

`supabase/migrations` is the database migration history. Migrations were created
using the pinned Supabase CLI. Do not edit applied migrations. No real private
records, passwords, authenticator keys, backups or staff photos belong in Git.
