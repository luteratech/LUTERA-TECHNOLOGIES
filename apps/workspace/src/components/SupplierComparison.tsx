"use client";
import { useEffect, useState } from "react";
import type { Row } from "@/lib/business";
import { api } from "@/lib/client";
import { money } from "@/lib/contracts";
import StatusBadge from "./StatusBadge";
export default function SupplierComparison({
  rows,
  open,
}: {
  rows: Row[];
  open: (row: Row) => void;
}) {
  const [names, setNames] = useState<Record<string, { label: string }>>({});
  useEffect(() => {
    let active = true;
    const refs = rows
      .flatMap((r, i) => [
        { key: "supplier_" + i, entity: "suppliers", id: r.supplier_id },
        { key: "rfq_" + i, entity: "commercial", id: r.rfq_id },
      ])
      .filter((r) => r.id);
    const load = async () => {
      const labels: typeof names = {};
      for (let i = 0; i < refs.length; i += 20) {
        const r = await api<{ references: typeof names }>(
          "business/references?values=" +
            encodeURIComponent(JSON.stringify(refs.slice(i, i + 20))),
          undefined,
          { notifications: false },
        );
        Object.assign(labels, r.references || {});
      }
      if (active) setNames(labels);
    };
    void load().catch(() => {});
    return () => {
      active = false;
    };
  }, [rows]);
  const groups = [
    ...new Set(rows.map((r) => String(r.rfq_id) + ":" + r.currency)),
  ];
  return (
    <div className="supplier-comparison">
      {groups.map((group) => {
        const offers = rows
          .filter((r) => String(r.rfq_id) + ":" + r.currency === group)
          .sort(
            (a, b) =>
              Number(a.amount_minor) +
              Number(a.shipping_minor || 0) -
              (Number(b.amount_minor) + Number(b.shipping_minor || 0)),
          );
        const i = rows.indexOf(offers[0]);
        return (
          <section key={group}>
            <h3>
              {names["rfq_" + i]?.label || "Supplier request"} ·{" "}
              {String(offers[0].currency)}
            </h3>
            <p className="muted">
              Equipment plus quoted shipping. Confirm inspection, warranty,
              duties and other costs before selecting.
            </p>
            <div className="table-scroll" tabIndex={0}>
              <table>
                <thead>
                  <tr>
                    <th>Supplier</th>
                    <th>Equipment</th>
                    <th>Shipping</th>
                    <th>Quoted total</th>
                    <th>Lead time</th>
                    <th>Terms & status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {offers.map((r) => (
                    <tr key={r.id}>
                      <td>
                        {names["supplier_" + rows.indexOf(r)]?.label ||
                          "Supplier"}
                      </td>
                      <td className="numeric">
                        {money(Number(r.amount_minor), String(r.currency))}
                      </td>
                      <td className="numeric">
                        {money(
                          Number(r.shipping_minor || 0),
                          String(r.currency),
                        )}
                      </td>
                      <td className="numeric">
                        {money(
                          Number(r.amount_minor) +
                            Number(r.shipping_minor || 0),
                          String(r.currency),
                        )}
                      </td>
                      <td>
                        {r.lead_days == null
                          ? "Not supplied"
                          : String(r.lead_days) + " days"}
                      </td>
                      <td>
                        <StatusBadge status={String(r.status || "Recorded")} />
                        <details>
                          <summary>Inspection, warranty & delivery</summary>
                          <p>{String(r.terms || "Terms not recorded")}</p>
                        </details>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="secondary"
                          onClick={() => open(r)}
                        >
                          Review offer
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
    </div>
  );
}
