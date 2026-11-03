"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import type { Row } from "@/lib/business";
import { displayDate, displayLabel } from "@/lib/workspace-display";
import RecordLink from "./RecordLink";
export default function InventoryOverview({ item }: { item: Row }) {
  const [data, setData] = useState<{
      balances: Row[];
      movements: Row[];
      assets: Row[];
    } | null>(null),
    [error, setError] = useState(""),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setData(null);
    setError("");
    api<NonNullable<typeof data>>(
      "business/inventory-overview?id=" + item.id,
      undefined,
      { notifications: false },
    )
      .then((r) => {
        if (
          !Array.isArray(r.balances) ||
          !Array.isArray(r.movements) ||
          !Array.isArray(r.assets)
        )
          throw Error("Stock details are unavailable.");
        if (active) setData(r);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [item.id, retry]);
  return (
    <section className="ops-gap">
      <h3>Stock & equipment history</h3>
      <p>
        Quarantined and reserved units are excluded from availability. Release
        holds through Stock quarantine after the agreed review.
      </p>
      {error ? (
        <div role="alert">
          <p>{error}</p>
          <button
            type="button"
            className="secondary"
            onClick={() => setRetry((v) => v + 1)}
          >
            Try again
          </button>
        </div>
      ) : !data ? (
        <p role="status">Loading stock history…</p>
      ) : (
        <>
          {data.balances.length ? (
            <div
              className="table-scroll"
              tabIndex={0}
              role="region"
              aria-label="Item stock by location"
            >
              <table>
                <thead>
                  <tr>
                    <th>Location</th>
                    <th>On hand</th>
                    <th>Reserved</th>
                    <th>Quarantined</th>
                    <th>Available</th>
                  </tr>
                </thead>
                <tbody>
                  {data.balances.map((r, i) => (
                    <tr key={i}>
                      <td>{String(r.location || "Unspecified")}</td>
                      {["on_hand", "reserved", "quarantined", "available"].map(
                        (k) => (
                          <td className="numeric" key={k}>
                            {Number(r[k] || 0)}
                          </td>
                        ),
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p>No stock balance is recorded for this item.</p>
          )}
          <h4>Recent movements</h4>
          {data.movements.length ? (
            <ul>
              {data.movements.map((r) => (
                <li key={r.id}>
                  <RecordLink entity="stock" id={r.id}>
                    {displayLabel(String(r.kind))} · {String(r.quantity)} units
                    · {displayDate(String(r.created_at))}
                  </RecordLink>
                  {r.serial ? " · " + String(r.serial) : ""}
                  {Boolean(r.order_id) && (
                    <span>
                      {" "}
                      ·{" "}
                      <RecordLink entity="commercial" id={String(r.order_id)}>
                        Source document
                      </RecordLink>
                    </span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p>No movements are recorded yet.</p>
          )}
          <h4>Customer equipment & warranties</h4>
          {data.assets.length ? (
            <ul>
              {data.assets.map((r) => (
                <li key={r.id}>
                  <RecordLink entity="assets" id={r.id}>
                    {String(r.serial || "Equipment record")}
                  </RecordLink>
                  {r.site ? " · " + String(r.site) : ""}
                  {r.warranty_until
                    ? " · Warranty ends " +
                      displayDate(String(r.warranty_until))
                    : ""}
                </li>
              ))}
            </ul>
          ) : (
            <p>No customer equipment is linked yet.</p>
          )}
          <small>
            Up to 20 recent movements and 20 equipment records are shown within
            your access.
          </small>
        </>
      )}
    </section>
  );
}
