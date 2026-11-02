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
    [key, setKey] = useState("");
  useUnsavedChanges(dirty);
  useEffect(() => {
    api<{ rows: Record<string, unknown>[] }>(
      "operations/list?entity=operating_policy",
    )
      .then((r) => {
        const p = r.rows[0];
        if (p) {
          setVersion(Number(p.version));
          setValues(
            Object.fromEntries([
              ...fields.map(([k]) => [k, p[k] == null ? "" : String(p[k])]),
              ["notes", String(p.notes || "")],
            ]),
          );
          setKey(crypto.randomUUID());
        }
      })
      .catch((e) => setMessage(e));
  }, []);
  return (
    <details className="ops-gap">
      <summary>Approval, retention and recovery policy</summary>
      <p>
        Approval remains required for sensitive financial actions. Leave
        undecided retention periods and recovery targets blank. Saving policy
        records the agreed direction; it does not delete records or claim a
        recovery guarantee.
      </p>
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
            <span>
              Owner/accountant agreement and operating responsibilities
            </span>
            <textarea
              maxLength={3000}
              value={values.notes || ""}
              onChange={(e) => {
                setValues((v) => ({ ...v, notes: e.target.value }));
                setDirty(true);
              }}
            />
          </label>
          <button disabled={busy}>Save operating policy</button>
        </form>
      )}
      {message && null}
    </details>
  );
}
