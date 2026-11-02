"use client";
import { useFeedback } from "@/lib/notifications";
import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import { money } from "@/lib/contracts";
import { businessDate, type Row } from "@/lib/business";
export default function BusinessReports() {
  const [data, setData] = useState<Record<string, Row[]> | null>(null),
    [error, setError] = useFeedback("error"),
    [cutoff, setCutoff] = useState(businessDate());
  useEffect(() => {
    api<Record<string, Row[]>>("operations/reports?cutoff=" + cutoff)
      .then(setData)
      .catch((e) => setError(e));
  }, [cutoff]);
  return (
    <>
      <section className="panel">
        <h2>Management reports</h2>
        <label className="field">
          <span>Report cutoff date (Africa/Lagos)</span>
          <input
            type="date"
            required
            value={cutoff}
            onChange={(e) => {
              if (e.target.value) setCutoff(e.target.value);
            }}
          />
        </label>
        <p>
          Balances and approved spending through the cutoff date, limited to
          your access. Reports show up to 1,000 detailed entries per section;
          use filtered archive exports for larger lists.
        </p>
        {error && null}
      </section>
      {data &&
        (
          [
            "receivables",
            "payables",
            "spending",
            "cost_centers",
            "projects",
            "commitments",
            "orders",
          ] as const
        ).map((section) => (
          <section className="panel" key={section}>
            <h3>
              {section === "orders"
                ? "Order contribution estimates"
                : section[0].toUpperCase() + section.slice(1)}
            </h3>
            {section === "orders" && (
              <p>
                Net invoiced sales less approved costs attributed to each order.
                This excludes unrecorded costs and accounting tax adjustments;
                it is not statutory profit.
              </p>
            )}
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Reference / category</th>
                    <th>Customer / supplier</th>
                    <th>Currency</th>
                    <th>Balance / spend</th>
                    <th>Ageing / contribution</th>
                  </tr>
                </thead>
                <tbody>
                  {(data[section] || []).map((r, i) => (
                    <tr key={r.id || i}>
                      <td
                        className={r.number ? "document-reference" : undefined}
                      >
                        {String(r.number || r.title || r.category || "")}
                      </td>
                      <td>{String(r.customer || r.supplier || "")}</td>
                      <td>{String(r.currency)}</td>
                      <td className="numeric">
                        {money(
                          Number(
                            r.outstanding_minor ??
                              r.amount_minor ??
                              r.invoiced_minor ??
                              0,
                          ),
                          String(r.currency),
                        )}
                      </td>
                      <td className="numeric">
                        {section === "orders"
                          ? money(
                              Number(r.invoiced_minor) -
                                Number(r.credited_minor) -
                                Number(r.recorded_cost_minor),
                              String(r.currency),
                            )
                          : String(r.ageing || r.due_on || "")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))}
    </>
  );
}
