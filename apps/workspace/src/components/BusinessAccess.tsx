"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import { EntryForm, type BusinessConfig } from "./BusinessWorkspace";
import { field } from "./business-fields";
import type { Row } from "@/lib/business";
export default function BusinessAccess({
  config,
}: {
  config: BusinessConfig | null;
}) {
  const [editing, setEditing] = useState(false),
    [rows, setRows] = useState<Row[]>([]),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const load = () =>
    api<{ rows: Row[] }>("business/list", {
      entity: "grants",
      query: "",
      page: 0,
      kind: "",
      status: "",
    })
      .then((r) => setRows(r.rows))
      .catch((e) => setError(e.message));
  useEffect(() => {
    if (config?.owner) void load();
  }, [config?.owner]);
  if (!config?.owner)
    return <p>The company owner manages business permissions.</p>;
  if (editing)
    return (
      <EntryForm
        title="Configure business access"
        config={config}
        button="Save access rules"
        onBack={() => setEditing(false)}
        fields={[
          field("email", "Approved staff email", "email", true),
          field("area", "Business area", "select", true, [
            "sales",
            "finance",
            "procurement",
            "inventory",
            "projects",
            "support",
            "reports",
          ]),
          field("scope", "Record scope", "select", true, ["assigned", "all"]),
          field("write_access", "May create and edit records", "checkbox"),
          field("approve_access", "May approve sensitive actions", "checkbox"),
        ]}
        submit={async (values, requestKey) => {
          await api("business/misc", {
            action: "grant",
            ...values,
            request_key: requestKey,
          });
          setEditing(false);
          setMessage("Business permissions saved.");
          await load();
        }}
      />
    );
  return (
    <section className="panel">
      <div className="toolbar">
        <div>
          <h2>Business permissions</h2>
          <p>
            Choose the areas each colleague can use. Limit access to assigned
            records where appropriate; approval rights are separate from
            editing.
          </p>
        </div>
        <button onClick={() => setEditing(true)}>Configure access</button>
      </div>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="notice">
          {message}
        </p>
      )}
      {rows.length ? (
        <div className="table-scroll">
          <table>
            <caption className="sr-only">Current business permissions</caption>
            <thead>
              <tr>
                <th>Staff email</th>
                <th>Area</th>
                <th>Scope</th>
                <th>Edit</th>
                <th>Approve</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id || String(r.email) + String(r.area)}>
                  <td>{String(r.email || "")}</td>
                  <td>{String(r.area || "")}</td>
                  <td>{String(r.scope || "")}</td>
                  <td>{r.write_access ? "Yes" : "No"}</td>
                  <td>{r.approve_access ? "Yes" : "No"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p>
          No explicit business grants are listed. The owner retains owner
          access.
        </p>
      )}
    </section>
  );
}
