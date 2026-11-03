"use client";
import { useEffect, useRef, useState } from "react";
import { api, saveFile } from "@/lib/client";
import { appNotice, dismissNotice, useFeedback } from "@/lib/notifications";
import { backupFeedback, type BackupResult } from "@/lib/backup-feedback";
import {
  backupCopyStatus,
  backupDate,
  backupSize,
  latestBackup,
} from "@/lib/operations-health";
import {
  HealthBadge,
  HealthError,
  useOperationsHealth,
} from "./AdministrationShared";
import PasswordInput from "./PasswordInput";

const folder =
  "https://drive.google.com/drive/folders/1M5R-up413YeEzlRudOPObu2f258gkktD";
export default function BusinessBackups() {
  const { data, error, refreshing, refresh } = useOperationsHealth();
  const [busy, setBusy] = useState(false);
  const [downloadBusy, setDownloadBusy] = useState("");
  const [result, setResult] = useState<ReturnType<
    typeof backupFeedback
  > | null>(null);
  const lock = useRef(false),
    notice = useRef<string | undefined>(undefined);
  const [, setMessage] = useFeedback();
  const latest = data ? latestBackup(data) : null;
  const primary =
    data?.latest_primary ??
    data?.backup_runs?.find((r) =>
      ["primary", "complete"].includes(r.status),
    ) ??
    (latest && ["primary", "complete"].includes(latest.status) ? latest : null);
  const drive =
    data?.latest_drive ??
    data?.backup_runs?.find((r) => r.status === "complete" && r.drive_verified);
  const runs = data?.backup_runs ?? (latest ? [latest] : []);
  const stale =
    primary &&
    Date.now() - Date.parse(primary.created_at) > 8 * 24 * 60 * 60 * 1000;
  useEffect(() => {
    if (!latest || !["running", "primary"].includes(latest.status)) return;
    const timer = setInterval(() => {
      if (!document.hidden) void refresh().catch(() => {});
    }, 30000);
    return () => clearInterval(timer);
  }, [latest?.status, refresh]);
  const download = async (action: string) => {
    setDownloadBusy(action);
    try {
      await saveFile(`business/${action}`, { confirmed: true });
    } catch (e) {
      setMessage(e as Error);
    } finally {
      setDownloadBusy("");
    }
  };
  const create = async () => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setResult(null);
    if (notice.current) dismissNotice(notice.current);
    notice.current = crypto.randomUUID();
    appNotice("Creating and verifying your encrypted backup.", "loading", {
      id: notice.current,
      title: "Creating backup",
    });
    try {
      const response = await api<BackupResult>(
        "business/backup-run",
        { confirmed: true },
        { notifications: false },
      );
      const feedback = backupFeedback(response);
      setResult(feedback);
      appNotice(feedback.message, feedback.tone, {
        id: notice.current,
        title: feedback.title,
      });
      await refresh().catch(() =>
        appNotice(
          "Your backup result was received, but its status could not refresh. Select Check status to retry.",
          "error",
          { title: "Status needs refresh" },
        ),
      );
    } catch (e) {
      const feedback = {
        title: "Backup result could not be confirmed",
        message:
          (e as Error).message + " Check the latest status before retrying.",
        tone: "error" as const,
      };
      setResult(feedback);
      appNotice(feedback.message, "error", {
        id: notice.current,
        title: feedback.title,
      });
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  return (
    <div className="admin-layout">
      {error && (
        <HealthError
          message={error}
          busy={refreshing}
          retry={() => void refresh().catch(() => {})}
        />
      )}
      {!data && !error && <p role="status">Loading backup status…</p>}
      {data && (
        <>
          <section
            className="panel admin-panel"
            aria-labelledby="backup-overview"
          >
            <div className="admin-section-heading">
              <div>
                <h2 id="backup-overview">Your backup status</h2>
                <p>
                  Encrypted workspace snapshots, with a separate copy in company
                  Google Drive.
                </p>
              </div>
              <button
                type="button"
                className="secondary"
                disabled={refreshing}
                onClick={() => void refresh().catch(() => {})}
              >
                {refreshing ? "Checking…" : "Check status"}
              </button>
            </div>
            <dl className="admin-backup-summary">
              <div>
                <dt>Last successful backup</dt>
                <dd>
                  {primary ? (
                    <time dateTime={primary.created_at}>
                      {backupDate(primary.created_at)}
                    </time>
                  ) : (
                    "No verified backup yet"
                  )}
                  <small>Abuja time</small>
                </dd>
              </div>
              <div>
                <dt>Supabase copy</dt>
                <dd>
                  <HealthBadge {...backupCopyStatus(latest, "primary")} />
                  <small>
                    {latest
                      ? "Latest backup attempt"
                      : "Create your first backup"}
                  </small>
                </dd>
              </div>
              <div>
                <dt>Google Drive copy</dt>
                <dd>
                  <HealthBadge {...backupCopyStatus(latest, "drive")} />
                  <small>
                    {drive
                      ? `Last verified: ${backupDate(drive.updated_at || drive.created_at)}`
                      : "Awaiting a verified copy receipt"}
                  </small>
                </dd>
              </div>
              <div>
                <dt>Next scheduled backup</dt>
                <dd>
                  {data.health.automatic_primary_backup_configured
                    ? String(
                        data.health.next_scheduled_primary_backup ||
                          "Check schedule",
                      )
                    : "Not scheduled"}
                  <small>Monday, 08:00 · Abuja time</small>
                </dd>
              </div>
            </dl>
            {data.health.encrypted_primary_backup === false && (
              <div className="admin-feedback" data-tone="danger">
                <strong>Backup setup needs attention</strong>
                <p>
                  Backup encryption is not configured. Contact the workspace
                  administrator.
                </p>
              </div>
            )}
            {latest?.status === "failed" && (
              <div className="admin-feedback" data-tone="danger">
                <strong>The latest backup failed</strong>
                <p>
                  {latest.last_error ||
                    "Create a new backup or review the connection settings."}{" "}
                  Any earlier successful copies remain available.
                </p>
              </div>
            )}
            {latest?.status === "primary" && latest.last_error && (
              <div className="admin-feedback" data-tone="warning">
                <strong>Google Drive needs attention</strong>
                <p>
                  {latest.last_error} Your verified Supabase copy remains
                  available.
                </p>
              </div>
            )}
            {stale && (
              <div className="admin-feedback" data-tone="warning">
                <strong>
                  Your last successful backup is over seven days old
                </strong>
                <p>Create a backup now and check the scheduled jobs.</p>
              </div>
            )}
            <div className="admin-toolbar">
              <button
                type="button"
                disabled={
                  busy || data.health.encrypted_primary_backup === false
                }
                aria-busy={busy}
                onClick={() => void create()}
              >
                {busy ? (
                  <>
                    <span className="app-spinner" aria-hidden="true" /> Creating
                    backup…
                  </>
                ) : (
                  "Create backup"
                )}
              </button>
              <a
                className="admin-folder-link"
                href={folder}
                target="_blank"
                rel="noopener noreferrer"
              >
                Open backup folder <span aria-hidden="true">↗</span>
              </a>
            </div>
            {result && (
              <div
                className="admin-feedback"
                data-tone={result.tone === "error" ? "danger" : result.tone}
                data-backup-result
              >
                <div>
                  <strong>{result.title}</strong>
                  <p>{result.message}</p>
                </div>
              </div>
            )}
          </section>
          <section
            className="panel admin-panel"
            aria-labelledby="backup-history"
          >
            <div className="admin-section-heading">
              <div>
                <h2 id="backup-history">Recent backups</h2>
                <p>
                  Each destination is verified separately. All times are Abuja
                  time.
                </p>
              </div>
            </div>
            {runs.length ? (
              <ul className="admin-backup-history">
                {runs.map((run, index) => (
                  <li key={run.id || index}>
                    <div>
                      <time dateTime={run.created_at}>
                        {backupDate(run.created_at)}
                      </time>
                      <small>
                        {run.file_count == null
                          ? "File count unavailable"
                          : `${run.file_count} uploaded ${run.file_count === 1 ? "file" : "files"}`}{" "}
                        ·{" "}
                        <span className="admin-figure">
                          {backupSize(run.bytes)}
                        </span>
                      </small>
                    </div>
                    <div>
                      <span className="admin-history-label">Supabase</span>
                      <HealthBadge {...backupCopyStatus(run, "primary")} />
                    </div>
                    <div>
                      <span className="admin-history-label">Google Drive</span>
                      <HealthBadge {...backupCopyStatus(run, "drive")} />
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="admin-empty">
                <strong>No backups recorded yet</strong>
                <p>Create your first backup to see its status here.</p>
              </div>
            )}
          </section>
        </>
      )}
      <section className="panel admin-panel" aria-labelledby="backup-tools">
        <div className="admin-section-heading">
          <div>
            <h2 id="backup-tools">Backup tools</h2>
            <p>Connection and recovery options for the workspace owner.</p>
          </div>
        </div>
        <details className="admin-disclosure">
          <summary>What is included in the backup?</summary>
          <div>
            <p>
              Saved customers, suppliers, sales and payment records, accounting,
              stock, projects, staff, approvals, signatures, website content and
              settings, with uploaded evidence and profile files.
            </p>
            <p>
              Auth passwords, MFA secrets, login sessions and unsaved work are
              excluded. Source code and brand assets remain in GitHub.
            </p>
          </div>
        </details>
        <details className="admin-disclosure">
          <summary>Manage Google Drive connection</summary>
          <div>
            <p>
              Weekly Drive copies run on Monday around 10:00 Abuja time. A copy
              receipt confirms a completed transfer; it does not prove that the
              next scheduled run will succeed.
            </p>
            <p>
              Use these setup instructions only when connecting or repairing the
              company script.
            </p>
            <div className="admin-toolbar">
              <button
                className="secondary"
                type="button"
                disabled={!!downloadBusy}
                onClick={() => void download("backup-drive-setup")}
              >
                {downloadBusy === "backup-drive-setup"
                  ? "Preparing…"
                  : "Download Drive connection"}
              </button>
              <a
                href="https://github.com/luteratech/LUTERA-TECHNOLOGIES/blob/main/docs/lutera-backup-setup.md"
                target="_blank"
                rel="noopener noreferrer"
              >
                Setup guide ↗
              </a>
            </div>
          </div>
        </details>
        <details className="admin-disclosure">
          <summary>Recovery tools</summary>
          <div>
            <p>
              Store the recovery key in your company password manager,
              separately from the backup files. It is needed to decrypt
              scheduled snapshots.
            </p>
            <button
              className="secondary"
              type="button"
              disabled={!!downloadBusy}
              onClick={() => void download("backup-recovery-key")}
            >
              {downloadBusy === "backup-recovery-key"
                ? "Preparing…"
                : "Download recovery key"}
            </button>
            <details className="admin-disclosure">
              <summary>Download a separate records export</summary>
              <ManualRecordsExport />
            </details>
          </div>
        </details>
      </section>
    </div>
  );
}
function ManualRecordsExport() {
  const [busy, setBusy] = useState(false);
  const [, setMessage] = useFeedback();
  return (
    <form
      className="admin-export-form"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget,
          values = new FormData(form);
        if (values.get("password") !== values.get("confirmation")) {
          setMessage(new Error("Backup passwords must match."));
          return;
        }
        setBusy(true);
        try {
          await saveFile("backup", { password: values.get("password") });
          form.reset();
        } catch (e) {
          setMessage(e as Error);
        } finally {
          setBusy(false);
        }
      }}
    >
      <p>
        A separate password-protected export of document, staff and website
        records. Use the full workspace snapshots above for business recovery.
      </p>
      <fieldset className="admin-form-fields" disabled={busy}>
        <legend className="sr-only">Records export password</legend>
        <div className="form-grid">
          <PasswordInput
            label="Backup password (at least 16 characters)"
            name="password"
            minLength={16}
            maxLength={256}
            required
            autoComplete="new-password"
          />
          <PasswordInput
            label="Confirm backup password"
            name="confirmation"
            minLength={16}
            maxLength={256}
            required
            autoComplete="new-password"
          />
        </div>
      </fieldset>
      <button className="secondary" disabled={busy}>
        {busy ? "Preparing export…" : "Download encrypted records"}
      </button>
    </form>
  );
}
