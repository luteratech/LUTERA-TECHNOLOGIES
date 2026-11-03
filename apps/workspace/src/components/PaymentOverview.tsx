"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import { money } from "@/lib/contracts";
import type { Row } from "@/lib/business";
import { displayDate } from "@/lib/workspace-display";
import RecordLink from "./RecordLink";
export default function PaymentOverview({ payment }: { payment: Row }) {
  const [data, setData] = useState<{
      allocated: number;
      refunded: number;
      available: number;
      invoices: Row[];
    } | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setData(null);
    api<typeof data>("business/payment-overview?id=" + payment.id, undefined, {
      notifications: false,
    })
      .then((r) => {
        if (active) {
          if (!r || !Array.isArray(r.invoices))
            throw new Error("Invalid payment summary");
          setData(r);
        }
      })
      .catch(() => {
        if (active)
          setError(
            "Allocation balances could not be loaded. Refresh before allocating or refunding.",
          );
      });
    return () => {
      active = false;
    };
  }, [payment.id]);
  return (
    <section
      className="record-overview"
      aria-label="Payment allocation overview"
    >
      <h3>Payment & allocation</h3>
      <dl className="record-summary">
        <div>
          <dt>Received</dt>
          <dd className="numeric">
            {money(Number(payment.amount_minor), String(payment.currency))}
          </dd>
        </div>
        <div>
          <dt>Allocated to invoices</dt>
          <dd className="numeric">
            {data ? money(data.allocated, String(payment.currency)) : "—"}
          </dd>
        </div>
        <div>
          <dt>Refunded</dt>
          <dd className="numeric">
            {data ? money(data.refunded, String(payment.currency)) : "—"}
          </dd>
        </div>
        <div>
          <dt>Available to allocate</dt>
          <dd className="numeric">
            {data ? money(data.available, String(payment.currency)) : "—"}
          </dd>
        </div>
      </dl>
      {error && <p role="alert">{error}</p>}
      {data?.invoices.length ? (
        <ul className="related-list">
          {data.invoices.map((r) => (
            <li key={r.id}>
              <RecordLink
                entity="commercial"
                id={String(r.invoice_id)}
                kind="invoice"
              >
                {String(r.number || "Invoice")}
              </RecordLink>
              <span>
                {money(Number(r.amount_minor), String(payment.currency))}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        data && (
          <p>
            No active invoice allocations. Unallocated money remains customer
            credit.
          </p>
        )
      )}
    </section>
  );
}
