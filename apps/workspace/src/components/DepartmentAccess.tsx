"use client";
import { useFeedback } from "@/lib/notifications";
import { useEffect, useState } from "react";
import { mayLeave, useUnsavedChanges } from "@/lib/unsaved";
import { displayLabel } from "@/lib/workspace-display";
import type { Row } from "@/lib/business";
import MultiSelect from "./MultiSelect";
import { api } from "@/lib/client";
import { areas } from "@/lib/business";
import type { SuiteConfig } from "@/lib/suite";
export const departmentChoices = areas.map((value) => ({
  value,
  label: value.charAt(0).toUpperCase() + value.slice(1),
}));
export default function DepartmentAccess({
  onBack,
  saved,
}: {
  onBack: () => void;
  saved: () => Promise<void>;
}) {
  const [members, setMembers] = useState<SuiteConfig["members"]>([]),
    [email, setEmail] = useState(""),
    [selected, setSelected] = useState<string[]>([]),
    [approvals, setApprovals] = useState<string[]>([]),
    [scope, setScope] = useState("assigned"),
    [edit, setEdit] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useFeedback("error"),
    [dirty, setDirty] = useState(false),
    [grants, setGrants] = useState<Row[]>([]);
  useUnsavedChanges(dirty);
  useEffect(() => {
    api<{ rows: Row[] }>("business/list", {
      entity: "grants",
      query: "",
      page: 0,
      kind: "",
      status: "",
    })
      .then((r) => setGrants(r.rows))
      .catch((e) => setError(e));
    api<SuiteConfig>("suite/config")
      .then((c) => setMembers(c.members.filter((m) => m.active)))
      .catch((e) => setError(e));
  }, []);
  return (
    <form
      className="panel"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        try {
          await api("business/grant-areas", {
            email,
            areas: selected,
            approvals,
            scope,
            edit,
          });
          setDirty(false);
          await saved();
        } catch (e) {
          setError(e as Error);
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2>Configure business access</h2>
      <p>
        Apply access to several departments in one save. Only selected
        departments are updated. Approval authority is independent of editing
        and workspace roles.
      </p>
      {email && (
        <section className="access-current">
          <h3>Current department access</h3>
          {grants.some((g) => g.email === email) ? (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Department</th>
                    <th>Records</th>
                    <th>Edit</th>
                    <th>Approve</th>
                  </tr>
                </thead>
                <tbody>
                  {grants
                    .filter((g) => g.email === email)
                    .map((g) => (
                      <tr key={String(g.area)}>
                        <td>{displayLabel(String(g.area))}</td>
                        <td>{displayLabel(String(g.scope))}</td>
                        <td>{g.write_access ? "Yes" : "No"}</td>
                        <td>{g.approve_access ? "Yes" : "No"}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p>
              No explicit department grants. Workspace roles may grant
              additional access.
            </p>
          )}
          <p>
            Choose the departments to update below. Unselected departments keep
            their current access.
          </p>
        </section>
      )}
      <div className="form-grid">
        <label className="field">
          <span>Approved colleague</span>
          <select
            aria-label="Approved colleague"
            required
            value={email}
            onChange={async (e) => {
              const next = e.target.value;
              if (await mayLeave()) {
                setEmail(next);
                setSelected([]);
                setApprovals([]);
                setDirty(false);
              }
            }}
          >
            <option value="">Choose a colleague…</option>
            {members.map((m) => (
              <option value={m.email} key={m.email}>
                {m.email}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Record scope</span>
          <select
            value={scope}
            onChange={(e) => {
              setScope(e.target.value);
              setDirty(true);
            }}
          >
            <option value="assigned">Assigned records only</option>
            <option value="all">All records in selected departments</option>
          </select>
        </label>
        <MultiSelect
          label="Business departments"
          options={departmentChoices}
          value={selected}
          onChange={(next) => {
            setDirty(true);
            setSelected(next);
            setApprovals(approvals.filter((a) => next.includes(a)));
          }}
          disabled={busy}
        />
        <MultiSelect
          label="Department approval authority"
          options={departmentChoices.filter((a) => selected.includes(a.value))}
          value={approvals}
          onChange={(next) => {
            setApprovals(next);
            setDirty(true);
          }}
          disabled={busy || !selected.length}
          hint="Select the departments where this colleague may approve sensitive actions. Leave empty for no approval authority in the selected departments."
        />
        <label className="check">
          <input
            type="checkbox"
            checked={edit}
            onChange={(e) => {
              setEdit(e.target.checked);
              setDirty(true);
            }}
          />
          May create and edit records in the selected departments
        </label>
      </div>
      <p>
        Saving with no approval selections removes approval authority from the
        selected departments. Other departments remain unchanged. Existing
        approval limits and document checks still apply.
      </p>
      {error && null}
      <div className="actions">
        <button disabled={busy || !email || !selected.length}>
          {busy ? "Saving…" : "Save access rules"}
        </button>
        <button
          className="secondary"
          type="button"
          disabled={busy}
          onClick={async () => {
            if (await mayLeave()) onBack();
          }}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
