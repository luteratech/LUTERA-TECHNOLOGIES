"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import { useFeedback } from "@/lib/notifications";
import { useUnsavedChanges } from "@/lib/unsaved";
import type { AutomationSettings } from "@/lib/operations-health";
import BusinessCalendar from "./BusinessCalendar";

const reminderOptions = [
  [
    "invoice_reminders",
    "Overdue invoices",
    "Email customers about unpaid invoices after their agreed due date.",
  ],
  [
    "delivery_notices",
    "Dispatch updates",
    "Email customers when a delivery is recorded as dispatched.",
  ],
  [
    "enquiry_reminders",
    "Enquiry follow-ups",
    "Remind Lutera to follow up on open enquiries.",
  ],
  [
    "maintenance_reminders",
    "Maintenance renewals",
    "Notify Lutera when maintenance is due for renewal.",
  ],
  [
    "warranty_reminders",
    "Warranty reviews",
    "Remind Lutera to review equipment warranties.",
  ],
  [
    "visit_reminders",
    "Maintenance visits",
    "Remind Lutera about scheduled maintenance visits.",
  ],
] as const;

export default function BusinessAdministration() {
  const [settings, setSettings] = useState<AutomationSettings | null>(null);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [failed, setFailed] = useState(false);
  const [, setMessage] = useFeedback();
  useUnsavedChanges(dirty);
  const load = () =>
    api<{ automation: AutomationSettings }>("business/health")
      .then((r) => {
        setSettings(r.automation);
        setFailed(false);
      })
      .catch((e) => {
        setFailed(true);
        setMessage(e);
      });
  useEffect(() => {
    void load();
  }, []);
  return (
    <div className="admin-layout">
      <section className="panel admin-panel" aria-labelledby="reminder-heading">
        <div className="admin-section-heading">
          <div>
            <h2 id="reminder-heading">Reminders & updates</h2>
            <p>
              Choose which messages Lutera sends to customers and your team.
            </p>
          </div>
        </div>
        {failed && (
          <div className="admin-feedback" data-tone="danger" role="alert">
            <p>Reminder settings could not be loaded.</p>
            <button
              type="button"
              className="secondary"
              onClick={() => void load()}
            >
              Try again
            </button>
          </div>
        )}
        {!settings && !failed && (
          <p role="status">Loading reminder settings…</p>
        )}
        {settings && (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              try {
                setSettings(
                  await api<AutomationSettings>(
                    "business/automation",
                    settings,
                  ),
                );
                setDirty(false);
                setMessage("Reminder settings saved.");
              } catch (error) {
                setMessage(error as Error);
              } finally {
                setBusy(false);
              }
            }}
          >
            <fieldset className="admin-form-fields" disabled={busy}>
              <legend className="sr-only">Reminder preferences</legend>
              <div className="admin-settings-rows">
                {reminderOptions.map(([key, title, description]) => (
                  <label className="admin-setting-row" key={key}>
                    <span>
                      <strong>{title}</strong>
                      <span>{description}</span>
                    </span>
                    <input
                      type="checkbox"
                      role="switch"
                      aria-label={title}
                      checked={!!settings[key]}
                      onChange={(e) => {
                        setSettings({ ...settings, [key]: e.target.checked });
                        setDirty(true);
                      }}
                    />
                  </label>
                ))}
              </div>
              <div className="field admin-short-field">
                <label htmlFor="reminder-interval">
                  Minimum reminder period in days
                </label>
                <input
                  id="reminder-interval"
                  aria-describedby="reminder-interval-help"
                  type="number"
                  min={1}
                  max={90}
                  required
                  value={settings.interval_days}
                  onChange={(e) => {
                    setSettings({
                      ...settings,
                      interval_days: Number(e.target.value),
                    });
                    setDirty(true);
                  }}
                />
                <small id="reminder-interval-help">
                  Wait this many days before repeating a reminder.
                </small>
              </div>
            </fieldset>
            <div className="admin-form-footer">
              <p>
                Check customer contact details before enabling external emails.
              </p>
              <button disabled={busy}>
                {busy ? "Saving…" : "Save reminder settings"}
              </button>
            </div>
          </form>
        )}
      </section>
      <BusinessCalendar />
    </div>
  );
}
