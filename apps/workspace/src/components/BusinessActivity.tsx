"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import type { Row } from "@/lib/business";
export default function BusinessActivity() {
  const [rows, setRows] = useState<Row[]>([]),
    [query, setQuery] = useState(""),
    [page, setPage] = useState(0),
    [more, setMore] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    const t = setTimeout(() => {
      api<{ rows: Row[]; more: boolean }>(
        "business/audit?page=" + page + "&query=" + encodeURIComponent(query),
      )
        .then((r) => {
          if (active) {
            setRows(r.rows);
            setMore(r.more);
            setError("");
          }
        })
        .catch((e) => {
          if (active) setError(e.message);
        });
    }, 200);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [page, query]);
  return (
    <section className="panel">
      <h2>Activity history</h2>
      <label className="field">
        <span>Filter by record type</span>
        <input
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(0);
          }}
          placeholder="For example: documents, payments, customers"
        />
      </label>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>When</th>
              <th>Action</th>
              <th>Record</th>
              <th>Actor</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>
                  {new Date(String(r.created_at)).toLocaleString("en-NG", {
                    timeZone: "Africa/Lagos",
                  })}
                </td>
                <td>{String(r.action)}</td>
                <td>
                  {String(r.entity)}
                  <small>{String(r.entity_id)}</small>
                </td>
                <td>
                  {String(r.actor) === "00000000-0000-0000-0000-000000000000"
                    ? "System — database management"
                    : String(r.actor)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="pagination">
        <button
          className="secondary"
          disabled={!page}
          onClick={() => setPage((p) => p - 1)}
        >
          Previous
        </button>
        <span>Page {page + 1}</span>
        <button
          className="secondary"
          disabled={!more}
          onClick={() => setPage((p) => p + 1)}
        >
          Next
        </button>
      </div>
    </section>
  );
}
