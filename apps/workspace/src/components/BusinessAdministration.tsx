"use client";
import { useEffect, useState } from "react";
import BusinessCalendar from "./BusinessCalendar";
import BusinessPolicy from "./BusinessPolicy";
import { api, saveFile } from "@/lib/client";
type Automation = {
  id: number;
  version: number;
  invoice_reminders: boolean;
  maintenance_reminders: boolean;
  enquiry_reminders: boolean;
  warranty_reminders: boolean;
  visit_reminders: boolean;
  delivery_notices: boolean;

  interval_days: number;
};
export default function BusinessAdministration() {
  const [settings, setSettings] = useState<Automation | null>(null),
    [health, setHealth] = useState<Record<string, unknown> | null>(null),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const load = async () => {
    const r = await api<{
      automation: Automation;
      health: Record<string, unknown>;
    }>("business/health");
    setSettings(r.automation);
    setHealth(r.health);
  };
  useEffect(() => {
    load().catch((e) => setMessage(e.message));
  }, []);
  return (
    <section className="panel">
      <h2>Business operations settings</h2>
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
      {health && (
        <dl className="record-summary">
          {Object.entries(health).map(([k, v]) => (
            <div key={k}>
              <dt>{k.replaceAll("_", " ")}</dt>
              <dd>
                {typeof v === "boolean"
                  ? v
                    ? "Configured"
                    : "Needs setup"
                  : typeof v === "object"
                    ? JSON.stringify(v)
                    : String(v)}
              </dd>
            </div>
          ))}
        </dl>
      )}
      {settings && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              const r = await api<Automation>("business/automation", settings);
              setSettings(r);
              setMessage(
                "Automation settings saved. Enabled reminders are checked daily against current records.",
              );
            } catch (e) {
              setMessage((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <h3>Approved reminders</h3>
          <p>
            Enable external invoice reminders only after reviewing customer
            contacts and opening balances. Maintenance reminders go to Lutera’s
            monitored company inbox.
          </p>
          <label className="check">
            <input
              type="checkbox"
              checked={settings.invoice_reminders}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  invoice_reminders: e.target.checked,
                })
              }
            />
            Email reminders for overdue invoices
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={settings.maintenance_reminders}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  maintenance_reminders: e.target.checked,
                })
              }
            />
            Notify Lutera about maintenance renewals
          </label>
          {(
            [
              ["enquiry_reminders", "Internal enquiry follow-up reminders"],
              ["warranty_reminders", "Internal warranty review reminders"],
              [
                "visit_reminders",
                "Internal scheduled maintenance visit reminders",
              ],
              ["delivery_notices", "Email customers when dispatch is recorded"],
            ] as const
          ).map(([key, label]) => (
            <label className="check" key={key}>
              <input
                type="checkbox"
                checked={!!settings[key]}
                onChange={(e) =>
                  setSettings({ ...settings, [key]: e.target.checked })
                }
              />
              {label}
            </label>
          ))}
          <label className="field">
            <span>Minimum reminder period in days</span>
            <input
              type="number"
              min={1}
              max={90}
              required
              value={settings.interval_days}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  interval_days: Number(e.target.value),
                })
              }
            />
          </label>
          <button disabled={busy}>Save reminder settings</button>
        </form>
      )}
      <BusinessCalendar />
      <BusinessPolicy />
      <details className="ops-gap">
        <summary>Backup and accounting arrangements</summary>
        <p>
          Encrypted backups are scheduled daily to a private Supabase bucket.
          Check the latest successful backup date in Operations health before
          relying on the schedule. Google Drive copies run after company Google
          background authorization is configured. A primary copy remains
          available if the Drive copy fails. Backups are retained until Lutera
          approves its retention policy; no automatic deletion is enabled.
          Download the recovery key and keep it in the company password manager,
          separate from the backup files.
        </p>
        <div className="actions">
          <button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                const r = await api<{ configured: boolean }>(
                  "business/backup-run",
                  { confirmed: true },
                );
                setMessage(
                  r.configured
                    ? "Backup check completed. Review the latest primary copy and Drive status in Operations health."
                    : "Backup encryption is not configured. Complete the company backup setup before relying on scheduled copies.",
                );
                await load();
              } catch (e) {
                setMessage((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            Run backup now
          </button>
          <button
            className="secondary"
            disabled={busy}
            onClick={async () => {
              try {
                await saveFile("business/backup-recovery-key", {
                  confirmed: true,
                });
              } catch (e) {
                setMessage((e as Error).message);
              }
            }}
          >
            Download recovery key
          </button>
          <button
            className="secondary"
            disabled={busy}
            onClick={async () => {
              try {
                await saveFile("business/backup-drive-setup", {
                  confirmed: true,
                });
              } catch (e) {
                setMessage((e as Error).message);
              }
            }}
          >
            Download Drive connection
          </button>
          <a
            href="https://drive.google.com/drive/folders/1M5R-up413YeEzlRudOPObu2f258gkktD"
            target="_blank"
            rel="noopener noreferrer"
          >
            Company backup folder ↗
          </a>
        </div>
        <p>
          Finance includes the company ledger and accountant CSV exports. The
          owner reviews opening balances and reconciliation while handling the
          accounts. Payments are recorded manually with uploaded evidence.
          Export amounts use their named currency and integer minor units.
        </p>
      </details>
    </section>
  );
}
