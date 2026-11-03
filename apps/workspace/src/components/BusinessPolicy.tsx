"use client";
import { useFeedback } from "@/lib/notifications";
import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import { useUnsavedChanges } from "@/lib/unsaved";
const fields = [
  [
    "financial_retention_days",
    "Financial records and evidence retention (days)",
  ],
  ["communication_retention_days", "Customer communication retention (days)"],
  ["staff_retention_days", "Staff-file retention (days)"],
  ["backup_retention_days", "Backup retention (days)"],
  ["recovery_point_hours", "Agreed recovery point target (hours)"],
  ["recovery_time_hours", "Agreed recovery time target (hours)"],
] as const;
export default function BusinessPolicy() {
  const [values, setValues] = useState<Record<string, string>>({}),
    [version, setVersion] = useState(0),
    [dirty, setDirty] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useFeedback(),
    [key, setKey] = useState(""),
    [failed, setFailed] = useState(false);
  useUnsavedChanges(dirty);
  const load = () =>
    api<{ rows: Record<string, unknown>[] }>(
      "operations/list?entity=operating_policy",
    )
      .then((r) => {
        const p = r.rows[0];
        if (p) {
          setFailed(false);
          setVersion(Number(p.version));
          setValues(
            Object.fromEntries([
              ...fields.map(([k]) => [k, p[k] == null ? "" : String(p[k])]),
              ["notes", String(p.notes || "")],
            ]),
          );
          setKey(crypto.randomUUID());
        } else
          throw new Error(
            "The operating policy is not available. Contact the workspace administrator.",
          );
      })
      .catch((e) => {
        setFailed(true);
        setMessage(e);
      });
  useEffect(() => {
    void load();
  }, []);
  return (
    <section className="panel admin-panel" aria-labelledby="policy-heading">
      <div className="admin-section-heading">
        <div>
          <h2 id="policy-heading">Retention & recovery targets</h2>
          <p>Record your agreed policy. Leave undecided values blank.</p>
        </div>
      </div>
      {!version && !failed && <p role="status">Loading operating policy…</p>}
      {failed && (
        <div className="admin-feedback" data-tone="danger" role="alert">
          <p>Operating policy could not be loaded.</p>
          <button
            type="button"
            className="secondary"
            onClick={() => void load()}
          >
            Try again
          </button>
        </div>
      )}
      <div className="admin-feedback" data-tone="info">
        <p>
          Saving these settings does not delete records or change the backup
          schedule. Backups currently run every seven days; a shorter
          recovery-point target needs more frequent backups.
        </p>
      </div>
      {version > 0 && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              const data = Object.fromEntries(
                fields.map(([k]) => [k, values[k] ? Number(values[k]) : ""]),
              );
              const r = await api<{ version: number }>("operations/command", {
                action: "operating-policy",
                version,
                request_key: key,
                data: { ...data, notes: values.notes || "" },
              });
              setVersion(r.version);
              setKey(crypto.randomUUID());
              setDirty(false);
              setMessage(
                "Policy recorded. Approval is still required; automatic retention deletion is not enabled.",
              );
            } catch (e) {
              setMessage(e as Error);
            } finally {
              setBusy(false);
            }
          }}
        >
          <fieldset className="admin-form-fields" disabled={busy}>
            <legend className="sr-only">Retention and recovery policy</legend>
            <div className="form-grid">
              {fields.map(([k, label]) => (
                <label className="field" key={k}>
                  <span>{label}</span>
                  <input
                    type="number"
                    min="1"
                    max={k.endsWith("hours") ? 168 : 36500}
                    value={values[k] || ""}
                    onChange={(e) => {
                      setValues((v) => ({ ...v, [k]: e.target.value }));
                      setDirty(true);
                    }}
                  />
                </label>
              ))}
            </div>
            <label className="field">
              <span>Owner notes and responsibilities</span>
              <textarea
                maxLength={3000}
                value={values.notes || ""}
                onChange={(e) => {
                  setValues((v) => ({ ...v, notes: e.target.value }));
                  setDirty(true);
                }}
              />
            </label>
          </fieldset>
          <div className="admin-form-footer">
            <p>
              Recovery targets are policy goals. Confirm them through a
              successful recovery test.
            </p>
            <button disabled={busy}>
              {busy ? "Saving…" : "Save operating policy"}
            </button>
          </div>
        </form>
      )}
      {message && null}
    </section>
  );
}
