"use client";
import { useFeedback } from "@/lib/notifications";
import { useEffect, useState } from "react";
import { api, saveFile } from "@/lib/client";
import { money, type BusinessDocument } from "@/lib/contracts";
export default function BusinessReceiptViewer({
  id,
  onBack,
}: {
  id: string;
  onBack: () => void;
}) {
  const [doc, setDoc] = useState<BusinessDocument | null>(null),
    [error, setError] = useFeedback("error");
  useEffect(() => {
    api<BusinessDocument>("business/legacy-document?id=" + id)
      .then(setDoc)
      .catch((e) => setError(e));
  }, [id]);
  return (
    <section className="panel">
      <div className="toolbar">
        <h2>{doc?.number || "Payment receipt"}</h2>
        <button className="secondary" onClick={onBack}>
          Back
        </button>
      </div>
      {error && null}
      {doc && (
        <>
          <p>{doc.payload.customer.name}</p>
          <p>
            {doc.payload.date} · {doc.payload.payment_method} ·{" "}
            {doc.payload.payment_reference || "No bank reference entered"}
          </p>
          <p className="ops-total">
            Amount received{" "}
            <strong>{money(doc.total_minor, doc.payload.currency)}</strong>
          </p>
          {doc.payload.evidence_id && (
            <p>
              <a href={"/api/business/file?id=" + doc.payload.evidence_id}>
                Download private payment evidence ↗
              </a>
            </p>
          )}
          <div className="actions">
            {(["pdf", "docx", "png"] as const).map((format) => (
              <button
                className="secondary"
                key={format}
                onClick={async () => {
                  try {
                    await saveFile("business/receipt-export", { id, format });
                  } catch (e) {
                    setError(e as Error);
                  }
                }}
              >
                Export {format.toUpperCase()}
              </button>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
