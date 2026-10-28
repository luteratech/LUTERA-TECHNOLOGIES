"use client";
import { useEffect, useId, useState } from "react";
import { api } from "@/lib/client";
import { minor, money } from "@/lib/contracts";
import { businessDate, type Area, type Entity, type Row } from "@/lib/business";
export type FieldDef = {
  key: string;
  label: string;
  type?:
    | "multi"
    | "text"
    | "textarea"
    | "date"
    | "datetime-local"
    | "money"
    | "rate"
    | "number"
    | "select"
    | "checkbox"
    | "ref"
    | "evidence"
    | "person"
    | "email";
  options?: string[];
  entity?: Entity;
  kind?: string;
  required?: boolean;
  default?: unknown;
  area?: Area;
  parentKey?: string;
  fulfilment?: boolean;
};
export const ref = (
  key: string,
  label: string,
  entity: Entity,
  required = false,
  kind?: string,
): FieldDef => ({ key, label, type: "ref", entity, required, kind });
export const field = (
  key: string,
  label: string,
  type: FieldDef["type"] = "text",
  required = false,
  options?: string[],
): FieldDef => ({ key, label, type, required, options });
const person = field("assigned_to", "Assigned colleague", "person");
const curr = field("currency", "Currency", "select", true, [
  "NGN",
  "USD",
  "GBP",
  "EUR",
]);
export const masterFields: Record<string, FieldDef[]> = {
  customers: [
    field("name", "Customer / organization name", "text", true),
    field("email", "Email", "email"),
    field("phone", "Phone"),
    field("address", "Billing address", "textarea"),
    field("delivery_address", "Delivery address", "textarea"),
    field("legal_name", "Registered / legal customer name"),
    field("tags", "Customer tags (comma separated)"),
    field("sector", "Sector"),
    field("tax_id", "Tax identifier (if supplied)"),
    person,
    field("archived", "Archived", "checkbox"),
  ],
  contacts: [
    ref("customer_id", "Customer", "customers", true),
    field("name", "Full name", "text", true),
    field("email", "Email", "email"),
    field("phone", "Phone"),
    field("job_title", "Contact role"),
  ],
  enquiries: [
    field("name", "Contact name", "text", true),
    field("email", "Email", "email"),
    field("phone", "Phone"),
    field("subject", "Enquiry subject", "text", true),
    field("message", "Requirements", "textarea"),
    {
      ...field(
        "services",
        "Requested services (select all that apply)",
        "multi",
        false,
        [
          "procurement",
          "hardware",
          "consulting",
          "support",
          "ai",
          "software",
          "data",
          "cloud",
        ],
      ),
      default: [],
    },
    ref("customer_id", "Customer", "customers"),
    person,
    field("follow_up", "Follow-up date", "date"),
    field("priority", "Priority", "select", true, [
      "normal",
      "low",
      "high",
      "urgent",
    ]),
    field("next_action", "Next action", "textarea"),
    {
      key: "evidence_id",
      label: "Enquiry attachment",
      type: "evidence",
      area: "sales",
    },
    field("status", "Stage", "select", true, [
      "new",
      "acknowledged",
      "qualified",
      "quoting",
      "won",
      "lost",
      "closed",
    ]),
    field("loss_reason", "Loss / closure reason", "textarea"),
  ],
  opportunities: [
    ref("customer_id", "Customer", "customers", true),
    ref("enquiry_id", "Source enquiry", "enquiries"),
    field("title", "Opportunity", "text", true),
    field("stage", "Stage", "select", true, [
      "qualified",
      "quoting",
      "negotiation",
      "won",
      "lost",
    ]),
    field("value_minor", "Estimated value", "money", true),
    curr,
    field("expected_close", "Expected close", "date"),
    person,
    field("notes", "Notes", "textarea"),
  ],
  suppliers: [
    field("name", "Supplier name", "text", true),
    field("email", "Email", "email"),
    field("phone", "Phone"),
    field("address", "Address", "textarea"),
    field("categories", "Supply categories"),
    field("terms", "Lead time, inspection and warranty terms", "textarea"),
    field("archived", "Archived", "checkbox"),
  ],
  items: [
    field("sku", "SKU / reference", "text", true),
    field("name", "Item / service name", "text", true),
    field("description", "Description", "textarea"),
    field("kind", "Item type", "select", true, [
      "stock",
      "to_order",
      "service",
    ]),
    { ...field("unit", "Unit of measure", "text", true), default: "unit" },
    field("unit_minor", "Suggested unit price", "money", true),
    curr,
    field("serialized", "Track individual serial numbers", "checkbox"),
    field("archived", "Archived", "checkbox"),
  ],
  cases: [
    field("kind", "Work type", "select", true, [
      "project",
      "ticket",
      "maintenance",
    ]),
    ref("customer_id", "Customer", "customers", true),
    ref("order_id", "Sales order", "commercial", false, "order"),
    field("title", "Title", "text", true),
    field("description", "Scope / issue / maintenance coverage", "textarea"),
    field("category", "Service category", "select", false, [
      "consulting",
      "procurement",
      "hardware",
      "installation-labs",
      "ai-automation",
      "software",
      "data",
      "cloud-integration",
    ]),
    field("priority", "Priority", "select", true, [
      "normal",
      "low",
      "high",
      "urgent",
    ]),
    field("status", "Status", "select", true, [
      "open",
      "active",
      "waiting",
      "completed",
      "closed",
    ]),
    person,
    field("starts_on", "Start date", "date"),
    field("due_on", "Target / renewal date", "date"),
    field("response_due_at", "Agreed response deadline", "datetime-local"),
    field("responded_at", "First response sent", "datetime-local"),
    field("accepted_by", "Customer acceptance name"),
    {
      key: "acceptance_id",
      label: "Project acceptance evidence",
      type: "evidence",
      area: "projects",
    },
  ],
  tasks: [
    ref("case_id", "Project / ticket / contract", "cases", true),
    field("title", "Task / milestone", "text", true),
    field("description", "Checklist / instructions", "textarea"),
    person,
    field("due_on", "Due date", "date"),
    ref("depends_on", "Prerequisite task", "tasks"),
    field(
      "customer_visible",
      "Show this milestone in the customer portal",
      "checkbox",
    ),
    field("status", "Status", "select", true, [
      "todo",
      "doing",
      "blocked",
      "done",
    ]),
    field(
      "billable",
      "Billable milestone (does not issue an invoice)",
      "checkbox",
    ),
  ],
};
export const paymentFields: FieldDef[] = [
  ref("customer_id", "Customer", "customers", true),
  field("amount_minor", "Amount received", "money", true),
  curr,
  {
    ...field("paid_on", "Payment date", "date", true),
    default: businessDate(),
  },
  field("method", "Payment method", "select", true, [
    "Bank transfer",
    "Cash",
    "Cheque",
    "Other",
  ]),
  field("reference", "Bank / payment reference"),
  {
    ...field("description", "Receipt description", "text", true),
    default: "Payment received",
  },
  {
    key: "evidence_id",
    label: "Payment evidence *",
    type: "evidence",
    required: true,
    area: "finance",
  },
  field(
    "confirmed",
    "I have checked that Lutera received this payment",
    "checkbox",
    true,
  ),
];
export const expenseFields: FieldDef[] = [
  ref("project_id", "Project / service engagement", "cases"),
  ref("purchase_id", "Source purchase order", "commercial", false, "purchase"),
  field("cost_center", "Cost centre"),
  ref("supplier_id", "Supplier (optional)", "suppliers"),
  ref("order_id", "Related sales order", "commercial", false, "order"),
  field("title", "Bill / expense description", "text", true),
  field("category", "Expense category", "select", true, [
    "equipment",
    "shipping",
    "installation",
    "software",
    "cloud",
    "travel",
    "office",
    "other",
  ]),
  field("amount_minor", "Amount", "money", true),
  curr,
  {
    ...field("incurred_on", "Incurred date", "date", true),
    default: businessDate(),
  },
  field("due_on", "Payment due date", "date"),
  {
    ...field(
      "fx_rate_micros",
      "Exchange rate (order currency per 1 bill currency)",
      "rate",
    ),
    default: 1000000,
  },
  field("fx_date", "Approved exchange-rate date", "date"),
  field("fx_reference", "Exchange-rate source / bank reference"),
  {
    key: "evidence_id",
    label: "Bill / expense evidence *",
    type: "evidence",
    required: true,
    area: "finance",
  },
];
export function initialValues(
  fields: FieldDef[],
  row?: Row | null,
  me?: string,
): Record<string, unknown> {
  return Object.fromEntries(
    fields.map((f) => {
      let v = row?.[f.key];
      if (f.key === "threshold_minor" && v == null) return [f.key, ""];
      if (v == null)
        v =
          f.default ??
          (f.type === "checkbox"
            ? false
            : f.type === "money" || f.type === "number"
              ? 0
              : f.type === "select"
                ? f.options?.[0] || ""
                : f.type === "person"
                  ? me || ""
                  : "");
      if (f.type === "money") v = (Number(v) / 100).toFixed(2);
      if (f.type === "rate") v = String(Number(v) / 1000000);
      if (f.type === "datetime-local" && v) {
        const d = new Date(String(v));
        v = new Intl.DateTimeFormat("sv-SE", {
          timeZone: "Africa/Lagos",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        })
          .format(d)
          .replace(" ", "T");
      }
      return [f.key, v];
    }),
  );
}
export function rateMicros(value: string) {
  if (!/^[0-9]{1,7}(\.[0-9]{1,6})?$/.test(value))
    throw new Error("Enter an exchange rate with up to six decimal places.");
  const [whole, fraction = ""] = value.split(".");
  const micros = Number(whole) * 1000000 + Number(fraction.padEnd(6, "0"));
  if (micros < 1 || micros > 1e12)
    throw new Error("Enter a valid positive exchange rate.");
  return micros;
}
export function payloadValues(
  fields: FieldDef[],
  values: Record<string, unknown>,
) {
  return Object.fromEntries(
    fields.map((f) => [
      f.key,
      f.type === "money"
        ? minor(String(values[f.key] || "0"))
        : f.type === "rate"
          ? rateMicros(String(values[f.key]))
          : f.type === "number"
            ? Number(values[f.key])
            : f.type === "datetime-local" && values[f.key]
              ? new Date(String(values[f.key]) + "+01:00").toISOString()
              : (values[f.key] ?? (f.type === "checkbox" ? false : "")),
    ]),
  );
}
export function Reference({
  entity,
  value,
  onChange,
  required,
  kind,
  parent,
  label,
  fulfilment,
}: {
  parent?: string;
  label?: string;
  fulfilment?: boolean;
  entity: Entity;
  value: string;
  onChange: (id: string) => void;
  required?: boolean;
  kind?: string;
}) {
  const [query, setQuery] = useState(""),
    [rows, setRows] = useState<Row[]>([]),
    [error, setError] = useState("");
  const id = useId();
  useEffect(() => {
    let active = true;
    const t = setTimeout(() => {
      api<{ rows: Row[] }>("business/list", {
        entity,
        query,
        page: 0,
        parent: parent || "",
        kind: kind || "",
        status: fulfilment ? "fulfilment" : "",
      })
        .then((r) => {
          if (active) {
            setRows(r.rows);
            setError("");
          }
        })
        .catch((e) => {
          if (active) setError(e.message);
        });
    }, 200);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [entity, query, kind, parent, fulfilment]);
  return (
    <div className="reference-picker">
      <input
        aria-label={label ? "Search " + label : "Search linked records"}
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by name, number or reference…"
        aria-controls={id}
      />
      <select
        aria-label={label || "Select linked record"}
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
      >
        <option value="">Select a record</option>
        {value && !rows.some((r) => r.id === value) && (
          <option value={value}>Linked record · {value.slice(0, 8)}</option>
        )}
        {rows.map((r) => (
          <option
            key={r.id || String(r.document_id)}
            value={r.id || String(r.document_id)}
          >
            {String(
              r.number ||
                r.reference ||
                r.name ||
                r.title ||
                r.description ||
                r.serial ||
                r.id,
            )}
            {r.status ? " · " + r.status : ""}
          </option>
        ))}
      </select>
      {error && <small role="alert">{error}</small>}
    </div>
  );
}
export function Evidence({
  value,
  onChange,
  area = "finance",
  required = false,
}: {
  value: string;
  onChange: (v: string) => void;
  area?: Area;
  parentKey?: string;
  fulfilment?: boolean;
  required?: boolean;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <div className="evidence-field">
      {value && (
        <a href={"/api/business/file?id=" + encodeURIComponent(value)}>
          Download uploaded evidence ↗
        </a>
      )}
      <input
        type="file"
        accept="application/pdf,image/jpeg,image/png,image/webp"
        required={required && !value}
        disabled={busy}
        aria-label="Upload evidence file"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          setBusy(true);
          setError("");
          try {
            if (file.size > 1048576)
              throw new Error("Choose an image under 1 MB.");
            const data = await new Promise<string>((resolve, reject) => {
              const r = new FileReader();
              r.onload = () => resolve(String(r.result).split(",")[1]);
              r.onerror = () =>
                reject(new Error("The file could not be read."));
              r.readAsDataURL(file);
            });
            const result = await api<Row>("business/file", {
              name: file.name,
              area,
              data,
            });
            onChange(result.id);
          } catch (err) {
            setError((err as Error).message);
          } finally {
            setBusy(false);
            e.target.value = "";
          }
        }}
      />
      <small>
        {busy
          ? "Uploading evidence…"
          : "PDF, JPEG, PNG or WebP, up to 1 MB. Evidence stays private."}
      </small>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
export function Fields({
  fields,
  values,
  onChange,
  people = [],
  disabled = false,
}: {
  fields: FieldDef[];
  values: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
  people?: { id: string; name: string }[];
  disabled?: boolean;
}) {
  return (
    <fieldset disabled={disabled} className="business-fields">
      <div className="form-grid">
        {fields.map((f) => (
          <label
            className={"field " + (f.type === "textarea" ? "full" : "")}
            key={f.key}
          >
            <span>
              {f.label}
              {f.required && f.type !== "checkbox" ? " *" : ""}
            </span>
            {f.type === "ref" ? (
              <Reference
                entity={f.entity!}
                label={f.label}
                fulfilment={f.fulfilment}
                kind={f.kind}
                parent={
                  f.parentKey ? String(values[f.parentKey] || "") : undefined
                }
                value={String(values[f.key] || "")}
                onChange={(v) => onChange(f.key, v)}
                required={f.required}
              />
            ) : f.type === "person" ? (
              <select
                value={String(values[f.key] || "")}
                onChange={(e) => onChange(f.key, e.target.value)}
              >
                <option value="">Unassigned</option>
                {people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            ) : f.type === "evidence" ? (
              <Evidence
                value={String(values[f.key] || "")}
                onChange={(v) => onChange(f.key, v)}
                area={f.area}
                required={f.required}
              />
            ) : f.type === "multi" ? (
              <select
                multiple
                aria-label={f.label}
                value={
                  Array.isArray(values[f.key])
                    ? (values[f.key] as string[])
                    : []
                }
                onChange={(e) =>
                  onChange(
                    f.key,
                    Array.from(e.target.selectedOptions, (o) => o.value),
                  )
                }
              >
                {f.options?.map((o) => (
                  <option key={o} value={o}>
                    {(
                      {
                        procurement: "IT procurement & sourcing",
                        hardware: "Computer hardware",
                        consulting: "Technology consulting",
                        support: "Installation & support",
                        ai: "AI & automation",
                        software: "Software development",
                        data: "Data analytics",
                        cloud: "Cloud & integration",
                      } as Record<string, string>
                    )[o] || o}
                  </option>
                ))}
              </select>
            ) : f.type === "select" ? (
              <select
                aria-label={f.label}
                required={f.required}
                value={String(values[f.key] || "")}
                onChange={(e) => onChange(f.key, e.target.value)}
              >
                {!f.required && <option value="">Not specified</option>}
                {f.options?.map((o) => (
                  <option key={o} value={o}>
                    {o.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            ) : f.type === "textarea" ? (
              <textarea
                rows={3}
                required={f.required}
                maxLength={6000}
                value={String(values[f.key] || "")}
                onChange={(e) => onChange(f.key, e.target.value)}
              />
            ) : f.type === "checkbox" ? (
              <input
                type="checkbox"
                checked={Boolean(values[f.key])}
                required={f.required}
                onChange={(e) => onChange(f.key, e.target.checked)}
              />
            ) : (
              <input
                type={
                  f.type === "money" || f.type === "rate"
                    ? "text"
                    : f.type || "text"
                }
                inputMode={
                  f.type === "money" || f.type === "rate"
                    ? "decimal"
                    : undefined
                }
                required={f.required}
                maxLength={f.type === "email" ? 254 : 600}
                min={f.type === "number" ? 0 : undefined}
                value={String(values[f.key] ?? "")}
                onChange={(e) => onChange(f.key, e.target.value)}
              />
            )}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
export function Summary({ row }: { row: Row }) {
  const entries = Object.entries(row).filter(
    ([k, v]) =>
      !["id", "version", "snapshot", "request_key", "sha256", "path"].includes(
        k,
      ) &&
      v !== null &&
      v !== "" &&
      typeof v !== "object",
  );
  const references = entries.filter(
    ([k]) => k.endsWith("_id") || k === "created_by" || k === "assigned_to",
  );
  return (
    <>
      <dl className="record-summary">
        {entries
          .filter(([k]) => !references.some(([r]) => r === k))
          .map(([k, v]) => (
            <div key={k}>
              <dt>{k.replaceAll("_", " ")}</dt>
              <dd>
                {k.endsWith("_minor")
                  ? money(Number(v), String(row.currency || "NGN"))
                  : typeof v === "boolean"
                    ? v
                      ? "Yes"
                      : "No"
                    : String(v)}
              </dd>
            </div>
          ))}
      </dl>
      {references.length > 0 && (
        <details className="record-references">
          <summary>Linked record references</summary>
          <dl className="record-summary">
            {references.map(([k, v]) => (
              <div key={k}>
                <dt>{k.replaceAll("_", " ")}</dt>
                <dd>{String(v)}</dd>
              </div>
            ))}
          </dl>
        </details>
      )}
    </>
  );
}
