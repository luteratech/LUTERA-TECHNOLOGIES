"use client";
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
