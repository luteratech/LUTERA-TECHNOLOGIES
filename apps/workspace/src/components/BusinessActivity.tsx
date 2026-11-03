"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import type { Row } from "@/lib/business";
import { displayLabel, displayDate } from "@/lib/workspace-display";
import RecordLink from "./RecordLink";
export default function BusinessActivity() {
  const [rows, setRows] = useState<Row[]>([]),
    [people, setPeople] = useState<{ id: string; name: string }[]>([]),
    [query, setQuery] = useState(""),
    [actor, setActor] = useState(""),
    [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [page, setPage] = useState(0),
    [more, setMore] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    const timer = setTimeout(() => {
      api<{ rows: Row[]; more: boolean; actors?: typeof people }>(
        "business/audit?" +
          new URLSearchParams({ page: String(page), query, actor, from, to }),
        undefined,
        { notifications: false },
      )
        .then((r) => {
          if (active) {
            setRows(r.rows);
            setMore(r.more);
            setPeople(r.actors || []);
            setError("");
          }
        })
        .catch((e) => {
          if (active) setError((e as Error).message);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 200);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [page, query, actor, from, to, retry]);
  return (
    <section className="panel">
      <h2>Recent activity</h2>
      <div className="form-grid">
        <label className="field">
          <span>Filter by record type</span>
          <input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(0);
            }}
            placeholder="For example: payments or customers"
          />
        </label>
        <label className="field">
          <span>Changed by</span>
          <select
            value={actor}
            onChange={(e) => {
              setActor(e.target.value);
              setPage(0);
            }}
          >
            <option value="">Everyone</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
            <option value="00000000-0000-0000-0000-000000000000">
              System maintenance
            </option>
          </select>
        </label>
        <label className="field">
          <span>From date</span>
          <input
            type="date"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              setPage(0);
            }}
          />
        </label>
        <label className="field">
          <span>Through date</span>
          <input
            type="date"
            min={from || undefined}
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              setPage(0);
            }}
          />
        </label>
      </div>
      {loading ? (
        <p role="status">Loading activity…</p>
      ) : error ? (
        <div className="admin-feedback" role="alert" data-tone="danger">
          <p>{error}</p>
          <button
            type="button"
            className="secondary"
            onClick={() => setRetry((v) => v + 1)}
          >
            Try again
          </button>
        </div>
      ) : rows.length ? (
        <div
          className="table-scroll"
          role="region"
          tabIndex={0}
          aria-label="Activity records"
        >
          <table>
            <thead>
              <tr>
                <th>When · Abuja time</th>
                <th>What happened</th>
                <th>Record</th>
                <th>Who</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const entity = String(r.entity).replace(/^work_/, "");
                const canLink =
                  [
                    "customers",
                    "commercial",
                    "payments",
                    "expenses",
                    "suppliers",
                    "cases",
                    "tasks",
                    "items",
                    "enquiries",
                    "assets",
                    "bank_lines",
                  ].includes(entity) &&
                  /^[a-f0-9-]{36}$/.test(String(r.entity_id));
                return (
                  <tr key={r.id}>
                    <td>{displayDate(String(r.created_at), true)}</td>
                    <td>{displayLabel(String(r.action))}</td>
                    <td>
                      {canLink ? (
                        <RecordLink
                          entity={entity}
                          id={String(r.entity_id)}
                          kind={
                            r.record_kind ? String(r.record_kind) : undefined
                          }
                        >
                          {String(
                            r.record_label || displayLabel(entity) + " record",
                          )}
                        </RecordLink>
                      ) : (
                        displayLabel(entity)
                      )}
                      <details className="audit-reference">
                        <summary>Reference</summary>
                        <span className="document-reference">
                          {String(r.entity_id)}
                        </span>
                      </details>
                    </td>
                    <td>
                      {String(r.actor) ===
                      "00000000-0000-0000-0000-000000000000"
                        ? "System maintenance"
                        : String(r.actor_name || "Workspace member")}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="compact-empty">
          <h3>No activity matches these filters</h3>
          <p>Recorded changes and approvals will appear here.</p>
        </div>
      )}
      <div className="pagination">
        <button
          className="secondary"
          disabled={loading || !page}
          onClick={() => setPage((p) => p - 1)}
        >
          Previous
        </button>
        <span>Page {page + 1}</span>
        <button
          className="secondary"
          disabled={loading || !more}
          onClick={() => setPage((p) => p + 1)}
        >
          Next
        </button>
      </div>
    </section>
  );
}
