# Lutera attachment scanning with Bouncer

4 November 2026. Bouncer is the selected hosted provider; no scanner server or
paid provider plan is provisioned by this integration.

## Activation

1. Create a company-controlled account at https://usebouncer.dev/dashboard/.
2. Choose the free tier and create an API key.
3. In Vercel → **lutera-workspace** → Settings → Environment Variables, add
   **BOUNCER_API_KEY**, Production only, using sensitive/encrypted storage.
   Never use `NEXT_PUBLIC_`, add it to the repository or paste it into chat.
4. Redeploy the workspace. The build verifies the key and the free account's
   quota without uploading a file or using a scan. An invalid/non-free account
   blocks that new build; it does not prove that the previous deployment scans.
5. In the existing private workspace, open Administration → Integrations,
   expand **Bouncer attachment scanning**, then **Check Bouncer connection**.
   This shows the allowance and reset time. Connection verification is not a
   completed-file scan test.
6. Upload a synthetic PDF/image with no company or personal information through
   the normal evidence form. Confirm that it finishes successfully. Review its
   corresponding result in Bouncer's dashboard. Use non-production fixtures for
   malicious/suspicious verdict testing; do not attach a test signature to a real
   payment or customer acceptance record.

Saving the key selects Bouncer automatically. `ATTACHMENT_SCANNER_PROVIDER=bouncer`
can select it explicitly; if selected without a valid key, uploads fail closed.
`none` explicitly disables scanning. The earlier ClamAV adapter remains available
for a future company-controlled scanner. A Bouncer error never falls back to an
unscanned upload or another provider.

## Upload path and limits

- New payment/business evidence, customer acceptance evidence, staff photos,
  profile avatars and signature images are scanned before storage/persistence.
- Original bytes are submitted server-side under a generic filename. Personal
  names and original filenames are not sent as upload metadata; the document
  contents still leave Lutera's hosting for processing by Bouncer.
- The API uses HTTPS, a fixed provider origin and a server-only key. Provider
  redirect/poll URLs are not followed. A completed `clean` verdict must identify
  the submitted scan and match the original file's SHA-256 hash.
- Suspicious/malicious/failed/unknown results, network errors, incorrect keys,
  exhausted quota, unverified hashes and timeouts block the upload. They never
  mark an unscanned file clean. Existing private files are not automatically
  rescanned.
- Polling is bounded to 45 seconds overall; a submission is never automatically
  repeated. A user retry is a new scan and can consume another allowance unit.
- The published free plan permits 500 scans/month. The preflight checks that the
  account is free and its reported limit is no more than 500. The application
  neither upgrades a plan nor purchases extra scans. Provider quota enforcement
  remains authoritative during concurrent uploads and other account usage.
- Existing workspace limits stay in force: evidence and photos up to 1 MB;
  signature source images up to 200 KB. The provider's larger 25 MB allowance
  does not increase Lutera's own upload limit.
- PDF reconstruction/image re-encoding, existing authorisation, private Storage
  policies and payment/acceptance approvals remain in effect. A scan result is
  not a guarantee against every threat.

## External processing and retention

Bouncer's published [privacy policy](https://usebouncer.dev/privacy/) and
[terms](https://usebouncer.dev/terms/) allow temporary file storage for up to
24 hours and retain scan metadata for account history. The privacy policy lists
Mumbai, India, as its storage region. The homepage's immediate-deletion claim
is less conservative; this integration and Lutera's notice use the 24-hour
policy, without promising earlier deletion. No API deletion operation is
invented. Company use remains subject to the provider's current terms.

## Verification

Automated fixtures exercise authentication/plan/quota failures, bounded polling,
malicious/suspicious/unknown verdicts, malformed responses, redirects, changed
scan IDs and hash mismatch. Tests use dummy bytes and do not transmit company
files. Deployment preflight checks connection/allowance only when a key is
configured; do not describe malware scanning as active before that deployment
and a real synthetic upload have been verified.

Official API reference: https://usebouncer.dev/docs/.
