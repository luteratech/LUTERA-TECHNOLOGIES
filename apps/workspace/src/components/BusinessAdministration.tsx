"use client";
import { useFeedback, appNotice, dismissNotice } from "@/lib/notifications";
import { backupFeedback, type BackupResult } from "@/lib/backup-feedback";
import { useEffect, useState, useRef } from "react";
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
    [message, setMessage] = useFeedback(),
    [busy, setBusy] = useState(false),
    [backupBusy, setBackupBusy] = useState(false),
    [backupResult, setBackupResult] = useState<ReturnType<
      typeof backupFeedback
    > | null>(null);
  const backupLock = useRef(false),
    lastBackupNotice = useRef<string | undefined>(undefined);
  const load = async (notifications = true) => {
    const r = await api<{
      automation: Automation;
      health: Record<string, unknown>;
    }>("business/health", undefined, { notifications });
    setSettings(r.automation);
    setHealth(r.health);
  };
  useEffect(() => {
    load().catch((e) => setMessage(e));
  }, []);
  return (
    <section className="panel">
      <h2>Business operations settings</h2>
      {message && null}
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
              setMessage(e as Error);
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
          Encrypted backups are scheduled every 7 days: Monday at 08:00
          Africa/Lagos, to a private Supabase bucket. Check the latest
          successful backup date in Operations health before relying on the
          schedule. Google Drive copies run after company Google background
          authorization is configured. A primary copy remains available if the
          Drive copy fails. Backups are retained until Lutera approves its
          retention policy; no automatic deletion is enabled. Download the
          recovery key and keep it in the company password manager, separate
          from the backup files.
        </p>
        <details className="ops-gap">
          <summary>What is included in the backup?</summary>
          <ul>
            <li>
              Customers, suppliers, enquiries, quotations, invoices, receipts,
              purchases and manual payment records.
            </li>
            <li>
              Accounting journals, chart of accounts, opening setup, period
              controls, bank matching, approvals and signatures.
            </li>
            <li>
              Stock, deliveries, assets, projects, tasks, support and
              maintenance records.
            </li>
            <li>
              Saved website content and drafts; staff profiles, workspace roles,
              permissions, company settings and audit history.
            </li>
            <li>
              Uploaded evidence, staff photos, profile avatars and
              customer-portal evidence in the four private file buckets.
            </li>
            <li>
              Document numbering and request history needed to prevent duplicate
              processing.
            </li>
          </ul>
          <p>
            Only saved data is included. Auth passwords, MFA secrets, login
            sessions, hosting credentials and unsaved edits are excluded. Source
            code, logos and templates remain versioned in GitHub; provider-level
            database/Auth recovery is separate.
          </p>
        </details>
        <div className="actions">
          <button
            disabled={busy || backupBusy}
            aria-busy={backupBusy}
            onClick={async () => {
              if (backupLock.current) return;
              backupLock.current = true;
              setBackupBusy(true);
              setBackupResult(null);
              if (lastBackupNotice.current)
                dismissNotice(lastBackupNotice.current);
              const noticeId = crypto.randomUUID();
              lastBackupNotice.current = noticeId;
              appNotice(
                "Creating and verifying the encrypted primary backup. You can keep working while it runs.",
                "loading",
                { id: noticeId, title: "Creating backup" },
              );
              try {
                const result = await api<BackupResult>(
                  "business/backup-run",
                  { confirmed: true },
                  { notifications: false },
                );
                const feedback = backupFeedback(result);
                setBackupResult(feedback);
                appNotice(feedback.message, feedback.tone, {
                  id: noticeId,
                  title: feedback.title,
                });
                try {
                  await load(false);
                } catch {
                  appNotice(
                    "The backup result was received, but the health panel could not refresh. Reload Operations settings to review its latest status.",
                    "error",
                    { title: "Health panel needs refresh" },
                  );
                }
              } catch (error) {
                const feedback = {
                  tone: "error" as const,
                  title: "Backup result could not be confirmed",
                  message:
                    (error as Error).message +
                    " Check the latest backup status before retrying.",
                };
                setBackupResult(feedback);
                appNotice(feedback.message, "error", {
                  id: noticeId,
                  title: feedback.title,
                });
              } finally {
                backupLock.current = false;
                setBackupBusy(false);
              }
            }}
          >
            {backupBusy ? (
              <>
                <span className="app-spinner" aria-hidden="true" /> Creating
                backup…
              </>
            ) : (
              "Run backup now"
            )}
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
                setMessage(e as Error);
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
                setMessage(e as Error);
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
        {backupResult && (
          <div
            className={backupResult.tone === "error" ? "error" : "notice"}
            data-backup-result
          >
            <strong>{backupResult.title}</strong>
            <p>{backupResult.message}</p>
          </div>
        )}
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
