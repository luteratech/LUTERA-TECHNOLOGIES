"use client";
import { useState } from "react";
import { api } from "@/lib/client";
import { useFeedback } from "@/lib/notifications";
import { backupDate } from "@/lib/operations-health";
type ScannerAllowance = {
  used: number;
  limit: number;
  remaining: number;
  resetsAt: string;
  tier: "free";
};
import {
  HealthBadge,
  HealthError,
  useOperationsHealth,
} from "./AdministrationShared";
const integrations = [
  [
    "public_site_publishing",
    "Website publishing",
    "Publish approved website changes to the public site.",
  ],
  [
    "business_email",
    "Business email",
    "Send approved customer and team messages.",
  ],
  [
    "signed_delivery_events",
    "Email delivery tracking",
    "Receive verified updates from the email provider.",
  ],
  [
    "attachment_malware_scanner",
    "Attachment scanning",
    "Check uploaded files for malware.",
  ],
  ["background_jobs", "Background jobs", "Process scheduled workspace tasks."],
] as const;
export default function BusinessIntegrations() {
  const { data, error, refreshing, refresh } = useOperationsHealth();
  const [checking, setChecking] = useState(false),
    [allowance, setAllowance] = useState<ScannerAllowance | null>(null),
    [, setNotice] = useFeedback();
  async function checkScanner() {
    setChecking(true);
    setAllowance(null);
    try {
      const result = await api<{ allowance: ScannerAllowance }>(
        "business/scanner-check",
        {},
      );
      setAllowance(result.allowance);
      setNotice(
        "Bouncer connection verified. " +
          result.allowance.remaining +
          " scans remain on the free plan.",
      );
    } catch (error) {
      setNotice(error as Error);
    } finally {
      setChecking(false);
    }
  }
  return (
    <div className="admin-layout">
      {error && (
        <HealthError
          message={error}
          busy={refreshing}
          retry={() => void refresh().catch(() => {})}
        />
      )}
      <section
        className="panel admin-panel"
        aria-labelledby="integration-heading"
      >
        <div className="admin-section-heading">
          <div>
            <h2 id="integration-heading">Connected services</h2>
            <p>
              Connection settings are checked here. Recent activity shows
              whether a service has actually run.
            </p>
          </div>
          <button
            className="secondary"
            type="button"
            disabled={refreshing}
            onClick={() => void refresh().catch(() => {})}
          >
            {refreshing ? "Checking…" : "Check connections"}
          </button>
        </div>
        {!data && !error && <p role="status">Loading connections…</p>}
        {data && (
          <>
            <div className="admin-settings-rows">
              {integrations.map(([key, title, description]) => (
                <div className="admin-setting-row" key={key}>
                  <div>
                    <strong>{title}</strong>
                    <p>{description}</p>
                    {key === "attachment_malware_scanner" &&
                      !data.health[key] && (
                        <p className="admin-warning-text">
                          Malware scanning is not active. File type and size
                          checks still apply.
                        </p>
                      )}
                  </div>
                  <HealthBadge
                    label={
                      data.health[key] === true
                        ? "Configured"
                        : data.health[key] === false
                          ? "Needs setup"
                          : "Unknown"
                    }
                    tone={data.health[key] === true ? "neutral" : "warning"}
                  />
                </div>
              ))}
            </div>
            <details className="admin-disclosure">
              <summary>Bouncer attachment scanning</summary>
              <p>
                The free plan has up to 500 scans per month. Files with failed,
                incomplete, suspicious or malicious results are not saved.
                Account quota is shared with any other use of the same Bouncer
                account.
              </p>
              {data.health.attachment_scanner_provider === "bouncer" &&
              data.health.attachment_malware_scanner ? (
                <button
                  type="button"
                  className="secondary"
                  disabled={checking || refreshing}
                  onClick={() => void checkScanner()}
                >
                  {checking ? "Checking Bouncer…" : "Check Bouncer connection"}
                </button>
              ) : (
                <p>
                  Setup pending. Add BOUNCER_API_KEY to the workspace’s private
                  production environment in Vercel, redeploy, then check
                  connections here. Keep the key out of website content and
                  client code.
                </p>
              )}
              {allowance && (
                <dl className="admin-queue-summary">
                  <div>
                    <dt>Free scans remaining</dt>
                    <dd className="admin-figure">
                      {allowance.remaining} / {allowance.limit}
                    </dd>
                  </div>
                  <div>
                    <dt>Next quota reset · Abuja time</dt>
                    <dd>{backupDate(allowance.resetsAt)}</dd>
                  </div>
                </dl>
              )}
              <p className="admin-footnote">
                The connection check does not upload a file or use a scan. Only
                new uploads are checked; previously stored files are not
                automatically rescanned. Bouncer processes files externally and
                its published policy allows retention for up to 24 hours.
              </p>
            </details>
            <p className="admin-footnote">
              Configured means connection settings are present. It does not
              confirm successful delivery or a completed scan.
            </p>
          </>
        )}
      </section>
      {data && (
        <section
          className="panel admin-panel"
          aria-labelledby="activity-heading"
        >
          <div className="admin-section-heading">
            <div>
              <h2 id="activity-heading">Work needing attention</h2>
              <p>Current queue counts from background processing.</p>
            </div>
          </div>
          <dl className="admin-queue-summary">
            {[
              ["failed_messages", "Failed messages"],
              ["pending_messages", "Pending messages"],
              ["unassigned_enquiries", "Unassigned enquiries"],
            ].map(([key, title]) => (
              <div key={key}>
                <dt>{title}</dt>
                <dd className="admin-figure">
                  {typeof data.health[key] === "number"
                    ? String(data.health[key])
                    : "Unavailable"}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      )}
    </div>
  );
}
