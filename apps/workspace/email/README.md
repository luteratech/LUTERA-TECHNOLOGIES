# Lutera account emails

## Status

The official private host is **https://workspace.luteratech.com**. Vercel has
verified the domain and Cloudflare DNS points it to the private project. The
public website remains **https://luteratech.com**.

The sending domain **mail.luteratech.com** is verified in the connected Resend
account. Click/open tracking is disabled. Receiving is not enabled; the email
prepared template bodies link to `support@luteratech.com` for help. General
website enquiries and business replies use `info@luteratech.com`; the receiving
domain has Zoho MX records. Reapply the generated templates to hosted Supabase
Auth to update templates previously pasted into its dashboard.
These changes do not move or replace the company's existing mailboxes.

The 13 templates, subjects and non-secret Auth configuration are prepared here.
The owner reported completing the hosted Auth URL, SMTP and template setup on
22 October 2026. Public Auth settings confirm signup is disabled and email
confirmation is enabled; the owner account has a verified authenticator. The owner also confirmed a fresh account email displays the company sender
name, logo and official workspace link correctly. Token acceptance and the
complete recovery flow have not been independently exercised. The connected Supabase MCP tool cannot inspect or
edit the hosted URL, SMTP or template settings directly, and no Management API
token is provisioned in the execution environment.
No SMTP password, API token or account email has been sent by these scripts.

## 1. Fix the localhost URL

Open https://supabase.com/dashboard/project/zwtjemhrubzgaueuyuxn/auth/url-configuration
and set:

| Setting | Value |
| --- | --- |
| Site URL | `https://workspace.luteratech.com/auth/confirm` |
| Redirect URL | `https://workspace.luteratech.com/auth/confirm` |

Remove production `localhost`, `127.0.0.1`, wildcard and obsolete GitHub Pages
redirect entries. Do not add the opaque workspace entry to this list. Email
templates send approved users to `/auth/confirm`, and only a successful verified
account action returns the internal entry path.

## 2. Enable company SMTP

Open https://supabase.com/dashboard/project/zwtjemhrubzgaueuyuxn/auth/smtp
and enable custom SMTP:

| Field | Value |
| --- | --- |
| Sender name | `Lutera Technology Ltd` |
| Sender email | `accounts@mail.luteratech.com` |
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | A Resend sending API key, created privately and restricted to `mail.luteratech.com` |

Create the key at https://resend.com/api-keys and paste it **directly into
Supabase**. Do not put it in chat, Git, templates or Vercel browser variables.
This setup does not create a receiving mailbox at the sender address.

Supabase's default email service cannot provide the intended production sender
identity. Current Supabase policy also limits template customization on new Free
projects using default SMTP. Custom SMTP is therefore part of this setup;
changing HTML alone will not change the From name/address.

## 3. Install all account templates

Open https://supabase.com/dashboard/project/zwtjemhrubzgaueuyuxn/auth/templates.
For each row in [manifest.json](manifest.json), copy the subject and corresponding
HTML file under `templates/`. This covers confirmations, invitations, recovery,
magic links, email changes, reauthentication and all seven security notifications.
Enable the security notifications in Supabase so their templates can be sent.

Use the complete generated link, including `token_hash` and `type`. Do not
replace it with `{{ .ConfirmationURL }}`: the default implicit URL returns
tokens in a browser fragment and does not establish the workspace's server
session. Do not use `{{ .RedirectTo }}` or user metadata as arbitrary link hosts.

Keep email confirmation and TOTP enabled, disable public signup, and set the
minimum password length to 12. Existing approved membership, role checks and
MFA remain mandatory. Template variables are Supabase Go templates; they are
not JavaScript or Python formatting fields.

## Optional: apply the reviewed configuration in one operation

An owner can run this **privately on their own machine**, using a scoped
Supabase Management API token set as `SUPABASE_ACCESS_TOKEN` in their terminal:

```sh
python3 configure.py                    # Preview the intended changes; no token needed
python3 configure.py --apply --urls-only # Fix URLs without requiring custom templates
python3 configure.py --apply             # Apply all settings after SMTP is configured
```

The target is pinned to the existing project `zwtjemhrubzgaueuyuxn`. The full
payload is [auth-config.json](auth-config.json); it contains no credentials.
The script checks the returned fields and never prints provider responses or
credentials. It does not configure an SMTP password or send emails. No service
role key is needed. Do not paste the Management API token into ChatGPT.

## Account actions

- Opening an email link only renders the branded confirmation page. An explicit
  same-origin POST consumes the one-time token, preventing link scanners from
  accepting invitations/resetting sessions through a GET request.
- Invitations let the recipient choose a matching password of at least 12
  characters. Only a confirmed, approved user can proceed. Authenticator
  enrollment/verification follows; no private records are exposed at AAL1.
- Recovery confirms the email, then sends the user through their existing
  authenticator to **My account**, where they choose a new password. A successful
  password change revokes the account's sessions on all devices. Losing both
  password and authenticator still requires company-owner recovery controls.
- A secure email change may require confirmation from both mailboxes. The new
  email must also be approved by the owner before workspace access is restored.
- Expired/used links show an actionable error without provider internals. Ask
  for a fresh email after changing the settings; old messages are not rewritten.
- The internal entry remains absent from public site links and email templates.
  Vercel's existing SSO protection remains on its `.vercel.app` deployments;
  custom-domain access is protected by application authentication, MFA and RLS.

## DNS records already configured and verified

All records are DNS only, TTL Auto. Existing root MX/SPF records were preserved.

| Type | Name under luteratech.com | Value | Priority |
| --- | --- | --- | --- |
| CNAME | `workspace` | `31f17d72628cf123.vercel-dns-017.com` | — |
| TXT | `resend._domainkey.mail` | `p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDJ1v4dZgNBbnMxG2w1iYoK6eTU5TpEjJnsg4gT/cAibQYAwJ7X0rSpHRPeYYxHYhyJqHvPc2jzw4zvN5C0svzkai6SsQW5ij5LMMOFRFX4nrVpdCbf+PxUVpmxuopnxm0tMB4H4DT36z1j76cu0lRbauVeoh8RLgjbEt5GkfIb6wIDAQAB` | — |
| MX | `send.mail` | `feedback-smtp.eu-west-1.amazonses.com` | 10 |
| TXT | `send.mail` | `v=spf1 include:amazonses.com ~all` | — |
| CNAME | `rsend.mail` | `send.forge.rmta.net` | — |

## Verification limits

Automated tests use fake auth responses and sample links; they never create
users, consume real email tokens or send messages. After saving or changing the
hosted settings, complete a fresh invitation and recovery flow with an approved
account, inspect its From identity/logo, and verify MFA is still required.
The owner has confirmed fresh-email delivery, company branding and the official
link host. The sender/template configuration has not been inspected through the
Management API, and the complete real-account recovery flow remains an owner
smoke check. The live account page and public PNG logo
return HTTP 200. GitHub Private workspace checks run 39837821483 passed both
application and database jobs for the email implementation commit cb1f9b0.

References: [Supabase email templates](https://supabase.com/docs/guides/auth/auth-email-templates),
[custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp),
[Resend with Supabase](https://resend.com/docs/send-with-supabase-smtp).
