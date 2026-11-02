"use client";
import { useFeedback } from "@/lib/notifications";
import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import type { BusinessDocument, Settings } from "@/lib/contracts";
import { Editor } from "./documents";
export default function BusinessQuoteEditor({
  id,
  onBack,
}: {
  id: string;
  onBack: () => void;
}) {
  const [record, setRecord] = useState<BusinessDocument | null>(null),
    [settings, setSettings] = useState<Settings | null>(null),
    [error, setError] = useFeedback("error");
  useEffect(() => {
    let active = true;
    Promise.all([
      api<BusinessDocument>("business/legacy-document?id=" + id),
      api<Settings>("business/quote-settings"),
    ])
      .then(([r, s]) => {
        if (active) {
          setRecord(r);
          setSettings(s);
        }
      })
      .catch((e) => {
        if (active) setError(e);
      });
    return () => {
      active = false;
    };
  }, [id]);
  if (error)
    return (
      <section className="panel">
        {null}
        <button className="secondary" onClick={onBack}>
          Back
        </button>
      </section>
    );
  if (!record || !settings) return <p role="status">Opening quotation…</p>;
  return (
    <Editor
      record={record}
      settings={settings}
      kind={record.kind}
      records={[]}
      onBack={onBack}
      onSaved={async (r) => setRecord(r)}
      onDeleted={async () => onBack()}
      business
    />
  );
}
