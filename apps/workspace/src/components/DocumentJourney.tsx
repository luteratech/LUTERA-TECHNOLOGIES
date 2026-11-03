"use client";
import { mayLeave } from "@/lib/unsaved";
import { workspaceLocation } from "@/lib/workspace-navigation";
import type { Access } from "@/lib/business";
export default function DocumentJourney({ access }: { access: Access }) {
  const steps = [
    { label: "Quotation", module: "quotes", area: "sales" },
    {
      label: "Sales order",
      module: "commercial",
      kind: "order",
      area: "sales",
    },
    {
      label: "Invoice",
      module: "commercial",
      kind: "invoice",
      area: "finance",
    },
    { label: "Payment & receipt", module: "payments", area: "finance" },
  ];
  return (
    <details className="panel document-journey">
      <summary>Sales document journey</summary>
      <nav aria-label="Sales document journey">
        {steps
          .filter((s) => access[s.area as keyof Access]?.read)
          .map((s, i) => (
            <button
              type="button"
              className="secondary"
              key={s.label}
              onClick={async () => {
                if (await mayLeave())
                  workspaceLocation({
                    section: "operations",
                    module: s.module,
                    kind: s.kind || null,
                    record: null,
                    tool: null,
                    document: null,
                    control: null,
                  });
              }}
            >
              <span className="numeric">{i + 1}</span> {s.label}
            </button>
          ))}
      </nav>
      <p>
        Start with the agreed quotation, create an order, then invoice the
        agreed work. Record money received manually with payment evidence before
        issuing its receipt. Earlier documents remain available in Document
        archive.
      </p>
    </details>
  );
}
