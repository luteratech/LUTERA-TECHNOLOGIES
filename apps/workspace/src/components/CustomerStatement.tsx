"use client";
import { useFeedback } from "@/lib/notifications";
import { useState } from "react";
import { api, saveFile } from "@/lib/client";
import { businessDate } from "@/lib/business";
export default function CustomerStatement({
  id,
  email,
}: {
  id: string;
  email: string;
}) {
  const [currency, setCurrency] = useState("NGN"),
    [from, setFrom] = useState(""),
    [to, setTo] = useState(businessDate()),
    [recipient, setRecipient] = useState(email),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useFeedback(),
    [requestKey, setRequestKey] = useState(() => crypto.randomUUID());
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setMessage("");
    try {
      await action();
    } catch (e) {
      setMessage(e as Error);
    } finally {
      setBusy(false);
    }
  }
  return (
    <details className="operation-record">
      <summary>Customer statements</summary>
      <div className="form-grid">
        <label className="field">
          <span>From date (optional)</span>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label className="field">
          <span>Through date</span>
          <input
            type="date"
            value={to}
            min={from || undefined}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
        <label className="field">
          <span>Statement currency</span>
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
          >
            {["NGN", "USD", "GBP", "EUR"].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Approved customer/contact email</span>
          <input
            type="email"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
          />
        </label>
      </div>
      <div className="actions">
        {["pdf", "csv"].map((format) => (
          <button
            key={format}
            className="secondary"
            disabled={busy}
            onClick={() =>
              void run(async () => {
                await saveFile("business/statement", {
                  customer_id: id,
                  from,
                  to,
                  currency,
                  format,
                });
              })
            }
          >
            Download {format.toUpperCase()}
          </button>
        ))}
        <button
          disabled={busy || !recipient}
          onClick={() =>
            void run(async () => {
              await api("operations/command", {
                action: "queue-statement",
                request_key: requestKey,
                data: { customer_id: id, from, to, currency, recipient },
              });
              setRequestKey(crypto.randomUUID());
              setMessage(
                "Statement queued. Review its delivery status in business messages.",
              );
            })
          }
        >
          Email statement PDF
        </button>
      </div>
      {message && null}
    </details>
  );
}
