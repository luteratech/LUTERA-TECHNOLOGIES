"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import { money } from "@/lib/contracts";
import { businessDate, type Row } from "@/lib/business";
import { displayDate, displayLabel } from "@/lib/workspace-display";
const sections = [
  "receivables",
  "payables",
  "spending",
  "cost_centers",
  "projects",
  "commitments",
  "orders",
] as const;
export default function BusinessReports() {
  const [cutoff, setCutoff] = useState(businessDate()),
    [currency, setCurrency] = useState(""),
    [result, setResult] = useState<{
      cutoff: string;
      data: Record<string, Row[]>;
    } | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    api<Record<string, Row[]>>(
      "operations/reports?cutoff=" + cutoff,
      undefined,
      { notifications: false },
    )
      .then((data) => {
        if (active) setResult({ cutoff, data });
      })
      .catch((e) => {
        if (active) setError((e as Error).message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [cutoff, retry]);
  const current = result?.cutoff === cutoff ? result.data : null;
  return (
    <div className="report-layout">
      <section className="panel">
        <div className="section-heading">
          <div>
            <h2>Report settings</h2>
            <p>
              Review balances and approved spending through the selected date.
            </p>
          </div>
        </div>
        <div className="form-grid">
          <label className="field">
            <span>Report cutoff date (Abuja time)</span>
            <input
              type="date"
              required
              value={cutoff}
              onChange={(e) => {
                if (e.target.value) setCutoff(e.target.value);
              }}
            />
          </label>
          <label className="field">
            <span>Currency</span>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
            >
              <option value="">All currencies, shown separately</option>
              {["NGN", "USD", "GBP", "EUR"].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
        </div>
        <details className="admin-disclosure">
          <summary>About these reports</summary>
          <p>
            Operational reports include approved source records within your
            access. Detailed sections show up to 1,000 entries; use the filtered
            record exports for larger lists. Posted financial statements are
            available in Accounting books.
          </p>
        </details>
      </section>
      {loading && (
        <p role="status">Loading reports for {displayDate(cutoff)}…</p>
      )}
      {error && (
        <div className="admin-feedback" data-tone="danger" role="alert">
          <div>
            <strong>Reports could not be loaded</strong>
            <p>{error} Figures for the selected date are not available.</p>
          </div>
          <button
            type="button"
            className="secondary"
            onClick={() => setRetry((v) => v + 1)}
          >
            Try again
          </button>
        </div>
      )}
      {!loading &&
        !error &&
        current &&
        sections.map((section) => {
          const rows = (current[section] || []).filter(
            (r) => !currency || r.currency === currency,
          );
          return (
            <section className="panel" key={section}>
              <h2>
                {section === "orders"
                  ? "Order contribution estimates"
                  : displayLabel(section)}
              </h2>
              {section === "orders" && (
                <p>
                  Net invoiced sales less recorded approved costs. Unrecorded
                  costs and tax adjustments are excluded.
                </p>
              )}
              <p className="muted">
                As at {displayDate(cutoff)} · {rows.length}{" "}
                {rows.length === 1 ? "entry" : "entries"}
              </p>
              {rows.length ? (
                <div
                  className="table-scroll"
                  tabIndex={0}
                  role="region"
                  aria-label={displayLabel(section) + " report"}
                >
                  <table>
                    <thead>
                      <tr>
                        <th>
                          {section === "cost_centers"
                            ? "Cost centre"
                            : "Reference / category"}
                        </th>
                        <th>
                          {section === "payables"
                            ? "Supplier"
                            : "Customer / supplier"}
                        </th>
                        <th>Currency</th>
                        <th>
                          {section === "orders"
                            ? "Net invoiced"
                            : "Balance / spend"}
                        </th>
                        <th>
                          {section === "orders"
                            ? "Contribution"
                            : "Ageing / due date"}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r, i) => (
                        <tr key={r.id || i}>
                          <td className="document-reference">
                            {String(
                              r.number ||
                                r.title ||
                                r.category ||
                                r.cost_center ||
                                "Uncategorised",
                            )}
                          </td>
                          <td>{String(r.customer || r.supplier || "—")}</td>
                          <td>{String(r.currency || "NGN")}</td>
                          <td className="numeric">
                            {money(
                              Number(
                                r.outstanding_minor ??
                                  r.amount_minor ??
                                  Number(r.invoiced_minor ?? 0) -
                                    Number(r.credited_minor ?? 0),
                              ),
                              String(r.currency || "NGN"),
                            )}
                          </td>
                          <td>
                            {section === "orders"
                              ? money(
                                  Number(r.invoiced_minor ?? 0) -
                                    Number(r.credited_minor ?? 0) -
                                    Number(r.recorded_cost_minor ?? 0),
                                  String(r.currency || "NGN"),
                                )
                              : r.ageing
                                ? displayLabel(String(r.ageing))
                                : r.due_on
                                  ? displayDate(String(r.due_on || r.due_date))
                                  : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="compact-empty">
                  <p>
                    No {displayLabel(section).toLowerCase()} entries for this
                    date{currency ? " and currency" : ""}.
                  </p>
                </div>
              )}
            </section>
          );
        })}
    </div>
  );
}
