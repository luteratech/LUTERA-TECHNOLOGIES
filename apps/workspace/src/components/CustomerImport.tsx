"use client";
import { useFeedback } from "@/lib/notifications";
import { useState } from "react";
import { api } from "@/lib/client";
type Preview = { row: number; name: string; email: string; duplicate: boolean };
export default function CustomerImport({ onSaved }: { onSaved: () => void }) {
  const [csv, setCSV] = useState(""),
    [rows, setRows] = useState<Preview[]>([]),
    [message, setMessage] = useFeedback(),
    [busy, setBusy] = useState(false),
    [key, setKey] = useState(() => crypto.randomUUID());
  return (
    <section className="panel">
      <h3>Import customer records</h3>
      <p>
        Use columns: name,email,phone,address,sector. Preview first; potential
        duplicates must be reviewed before importing.
      </p>
      <label className="field">
        <span>Customer CSV</span>
        <textarea
          rows={5}
          value={csv}
          onChange={(e) => {
            setCSV(e.target.value);
            setRows([]);
          }}
        />
      </label>
      <div className="actions">
        <button
          className="secondary"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              const r = await api<{ rows: Preview[] }>(
                "business/customer-import",
                { csv, confirm: false, request_key: key },
              );
              setRows(r.rows);
              setMessage("Preview ready. Check names and duplicate warnings.");
            } catch (e) {
              setMessage(e as Error);
            } finally {
              setBusy(false);
            }
          }}
        >
          Preview import
        </button>
        <button
          disabled={busy || !rows.length || rows.some((r) => r.duplicate)}
          onClick={async () => {
            setBusy(true);
            try {
              const r = await api<{ inserted: number }>(
                "business/customer-import",
                { csv, confirm: true, request_key: key },
              );
              setMessage(`${r.inserted} customers imported.`);
              setRows([]);
              setCSV("");
              setKey(crypto.randomUUID());
              onSaved();
            } catch (e) {
              setMessage(e as Error);
            } finally {
              setBusy(false);
            }
          }}
        >
          Import reviewed records
        </button>
      </div>

      {rows.length > 0 && (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>CSV row</th>
                <th>Customer</th>
                <th>Email</th>
                <th>Review</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.row}>
                  <td>{r.row}</td>
                  <td>{r.name}</td>
                  <td>{r.email}</td>
                  <td>
                    {r.duplicate
                      ? "Possible duplicate — review existing record"
                      : "Ready"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
