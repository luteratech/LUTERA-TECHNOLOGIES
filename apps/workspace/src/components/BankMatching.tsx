"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import { money } from "@/lib/contracts";
import { displayDate, recordName } from "@/lib/workspace-display";
import type { Row } from "@/lib/business";
export default function BankMatching({
  line,
  choose,
}: {
  line: Row;
  choose: (id: string) => void;
}) {
  const [rows, setRows] = useState<Row[] | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    api<{ rows: Row[] }>("business/bank-candidates?id=" + line.id, undefined, {
      notifications: false,
    })
      .then((r) => {
        if (active) {
          if (!Array.isArray(r.rows)) throw new Error("Invalid match preview");
          setRows(r.rows);
        }
      })
      .catch(() => {
        if (active)
          setError(
            "Matching suggestions are unavailable. Use the reviewed matching action below.",
          );
      });
    return () => {
      active = false;
    };
  }, [line.id]);
  return (
    <section className="record-overview">
      <h3>Review this statement line</h3>
      <p>
        <strong>
          {money(Number(line.amount_minor), String(line.currency))}
        </strong>{" "}
        · {displayDate(String(line.posted_on))} ·{" "}
        {String(line.reference || "No reference")}
      </p>
      {Number(line.amount_minor) < 0 ? (
        <p>
          Money paid out: use Outgoing bank matching to link an already recorded
          supplier payment or refund.
        </p>
      ) : (
        <>
          <h4>Unmatched payments with the same amount and currency</h4>
          {error ? (
            <p role="status">{error}</p>
          ) : rows === null ? (
            <p role="status">Finding candidates…</p>
          ) : rows.length ? (
            <ul className="candidate-list">
              {rows.map((r) => (
                <li key={r.id}>
                  <div>
                    <strong>{recordName(r)}</strong>
                    <small>
                      {displayDate(String(r.paid_on))} ·{" "}
                      {money(Number(r.amount_minor), String(r.currency))}
                    </small>
                  </div>
                  <button
                    className="secondary"
                    type="button"
                    onClick={() => choose(r.id)}
                  >
                    Review match
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p>
              No exact candidates. Confirm that the payment has been recorded,
              then use Match bank line to search.
            </p>
          )}
        </>
      )}
      <p className="muted">
        Matching reconciles existing records; it does not move money or create a
        payment.
      </p>
    </section>
  );
}
