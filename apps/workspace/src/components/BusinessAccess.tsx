"use client";
import { useFeedback } from "@/lib/notifications";
import { useEffect, useState } from "react";
import AccessJourney from "./AccessJourney";
import { displayLabel } from "@/lib/workspace-display";
import UserResponsibilities from "./UserResponsibilities";
import { api } from "@/lib/client";
import type { BusinessConfig } from "./BusinessWorkspace";
import DepartmentAccess from "./DepartmentAccess";
import type { Row } from "@/lib/business";
export default function BusinessAccess({
  config,
}: {
  config: BusinessConfig | null;
}) {
  const [editing, setEditing] = useState(false),
    [rows, setRows] = useState<Row[]>([]),
    [error, setError] = useFeedback("error"),
    [message, setMessage] = useFeedback();
  const load = () =>
    api<{ rows: Row[] }>("business/list", {
      entity: "grants",
      query: "",
      page: 0,
      kind: "",
      status: "",
    })
      .then((r) => setRows(r.rows))
      .catch((e) => setError(e));
  useEffect(() => {
    if (config?.owner) void load();
  }, [config?.owner]);
  if (!config?.owner)
    return <p>The company owner manages business permissions.</p>;
  if (editing)
    return (
      <DepartmentAccess
        onBack={() => setEditing(false)}
        saved={async () => {
          setEditing(false);
          setMessage("Business permissions saved.");
          await load();
        }}
      />
    );
  return (
    <>
      <AccessJourney active="permissions" />
      <details className="panel access-sensitive">
        <summary>Signing, posting & period closing authority</summary>
        <UserResponsibilities />
      </details>
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
        {error && null}
        {message && null}
        {rows.length ? (
          <div className="table-scroll">
            <table>
              <caption className="sr-only">
                Current business permissions
              </caption>
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
                    <td>{displayLabel(String(r.area || ""))}</td>
                    <td>{displayLabel(String(r.scope || ""))}</td>
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
    </>
  );
}
