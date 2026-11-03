"use client";
import { useFeedback } from "@/lib/notifications";
import { useEffect, useId, useState } from "react";
import StatusBadge from "./StatusBadge";
import MultiSelect from "./MultiSelect";
import RecordLink from "./RecordLink";
import {
  displayLabel,
  displayDate,
  recordOption,
  linkedEntities,
} from "@/lib/workspace-display";
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
  step?: number | string;
  min?: number;
  max?: number;
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
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [selected, setSelected] = useState<{
    id: string;
    label: string;
  } | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const id = useId();
  useEffect(() => {
    let active = true;
    setLoading(true);
    const timer = setTimeout(() => {
      api<{ rows: Row[] }>(
        "business/list",
        {
          entity,
          query,
          page: 0,
          parent: parent || "",
          kind: kind || "",
          status: fulfilment ? "fulfilment" : "",
        },
        { notifications: false },
      )
        .then((r) => {
          if (active) {
            setRows(r.rows);
            setError("");
          }
        })
        .catch(() => {
          if (active) setError("Records could not be loaded.");
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 200);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [entity, query, kind, parent, fulfilment, retry]);
  useEffect(() => {
    if (!value) {
      setSelected(null);
      return;
    }
    const row = rows.find((r) => (r.id || r.document_id) === value);
    if (row) {
      setSelected({ id: value, label: recordOption(row) });
      return;
    }
    if (selected?.id === value) return;
    let active = true;
    api<{ references: Record<string, { label: string }> }>(
      "business/references?values=" +
        encodeURIComponent(
          JSON.stringify([{ key: "selected", entity, id: value }]),
        ),
      undefined,
      { notifications: false },
    )
      .then((r) => {
        if (active && r.references.selected)
          setSelected({ id: value, label: r.references.selected.label });
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [value, entity, rows, selected?.id]);
  return (
    <div className="reference-picker">
      <div className="reference-control">
        <select
          id={id}
          aria-label={label || "Select linked record"}
          value={value}
          required={required}
          onChange={(e) => {
            const row = rows.find(
              (r) => (r.id || r.document_id) === e.target.value,
            );
            if (row)
              setSelected({ id: e.target.value, label: recordOption(row) });
            onChange(e.target.value);
            setOpen(false);
          }}
        >
          <option value="">
            {loading
              ? "Loading records…"
              : "Choose " + (label?.toLowerCase() || "a record")}
          </option>
          {value && !rows.some((r) => (r.id || r.document_id) === value) && (
            <option value={value}>
              {selected?.id === value ? selected.label : "Selected record"}
            </option>
          )}
          {rows.map((r) => (
            <option
              key={r.id || String(r.document_id)}
              value={r.id || String(r.document_id)}
            >
              {recordOption(r)}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="secondary reference-search-toggle"
          aria-label={"Find " + (label || "linked record")}
          aria-expanded={open}
          aria-controls={id + "-search"}
          onClick={() => setOpen((v) => !v)}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            aria-hidden="true"
          >
            <circle cx="10.5" cy="10.5" r="6.5" />
            <path d="m16 16 5 5" />
          </svg>
        </button>
      </div>
      {open && (
        <div id={id + "-search"} className="reference-search-panel">
          <input
            autoFocus
            type="search"
            aria-label={label ? "Search " + label : "Search linked records"}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Name, number or reference…"
          />
          <p role="status">
            {loading
              ? "Searching…"
              : error ||
                (!rows.length
                  ? "No matching records. Try another search or create the record first."
                  : rows.length +
                    " matching records. Choose from the list above.")}
          </p>
          {error && (
            <button
              className="text-button"
              type="button"
              onClick={() => setRetry((v) => v + 1)}
            >
              Try again
            </button>
          )}
        </div>
      )}
      {!open && error && (
        <p className="form-help" role="status">
          {error}{" "}
          <button
            className="text-button"
            type="button"
            onClick={() => setRetry((v) => v + 1)}
          >
            Retry
          </button>
        </p>
      )}
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
    [error, setError] = useFeedback("error"),
    [filename, setFilename] = useState("");
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
              throw new Error("Choose a PDF or image up to 1 MB.");
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
            setFilename(file.name);
            onChange(result.id);
          } catch (err) {
            setError(err as Error);
          } finally {
            setBusy(false);
            e.target.value = "";
          }
        }}
      />
      {filename && <span className="uploaded-filename">{filename}</span>}
      <small>
        {busy
          ? "Uploading evidence…"
          : "PDF, JPEG, PNG or WebP, up to 1 MB. Evidence stays private."}
      </small>
      {error && null}
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
  const prefix = useId();
  return (
    <fieldset disabled={disabled} className="business-fields">
      <div className="form-grid">
        {fields.map((f) => (
          <div
            className={"field " + (f.type === "textarea" ? "full" : "")}
            key={f.key}
          >
            {f.type !== "multi" &&
              (["ref", "evidence"].includes(f.type || "") ? (
                <span>
                  {f.label.replace(/\s*\*+$/, "")}
                  {f.required ? " *" : ""}
                </span>
              ) : (
                <label htmlFor={`${prefix}-${f.key}`}>
                  <span>
                    {f.label.replace(/\s*\*+$/, "")}
                    {f.required && f.type !== "checkbox" ? " *" : ""}
                  </span>
                </label>
              ))}
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
                id={`${prefix}-${f.key}`}
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
              <MultiSelect
                label={f.label}
                value={
                  Array.isArray(values[f.key])
                    ? (values[f.key] as string[])
                    : []
                }
                options={(f.options || []).map((value) => ({
                  value,
                  label: displayLabel(value),
                }))}
                onChange={(v) => onChange(f.key, v)}
                required={f.required}
                disabled={disabled}
              />
            ) : f.type === "select" ? (
              <select
                id={`${prefix}-${f.key}`}
                aria-label={f.label}
                required={f.required}
                value={String(values[f.key] || "")}
                onChange={(e) => onChange(f.key, e.target.value)}
              >
                {!f.required && <option value="">Not specified</option>}
                {f.options?.map((o) => (
                  <option key={o} value={o}>
                    {displayLabel(o)}
                  </option>
                ))}
              </select>
            ) : f.type === "textarea" ? (
              <textarea
                id={`${prefix}-${f.key}`}
                rows={3}
                required={f.required}
                maxLength={6000}
                value={String(values[f.key] || "")}
                onChange={(e) => onChange(f.key, e.target.value)}
              />
            ) : f.type === "checkbox" ? (
              <input
                id={`${prefix}-${f.key}`}
                type="checkbox"
                checked={Boolean(values[f.key])}
                required={f.required}
                onChange={(e) => onChange(f.key, e.target.checked)}
              />
            ) : (
              <input
                id={`${prefix}-${f.key}`}
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
                min={f.min ?? (f.type === "number" ? 0 : undefined)}
                max={f.max}
                step={f.step ?? (f.type === "number" ? 1 : undefined)}
                value={String(values[f.key] ?? "")}
                onChange={(e) => onChange(f.key, e.target.value)}
              />
            )}
          </div>
        ))}
      </div>
    </fieldset>
  );
}
export function Summary({ row }: { row: Row }) {
  const [names, setNames] = useState<
    Record<string, { label: string; entity: string; id: string; kind?: string }>
  >({});
  const refs = Object.entries(row).filter(
    ([key, value]) => value && linkedEntities[key],
  );
  const refKey = refs.map(([key, value]) => key + ":" + value).join("|");
  useEffect(() => {
    if (!refs.length) {
      setNames({});
      return;
    }
    let active = true;
    api<{ references: typeof names }>(
      "business/references?values=" +
        encodeURIComponent(
          JSON.stringify(
            refs
              .slice(0, 20)
              .map(([key, id]) => ({ key, id, entity: linkedEntities[key] })),
          ),
        ),
      undefined,
      { notifications: false },
    )
      .then((r) => {
        if (active) setNames(r.references || {});
      })
      .catch(() => {
        if (active) setNames({});
      });
    return () => {
      active = false;
    };
  }, [refKey]);
  const internal = new Set([
    "id",
    "version",
    "snapshot",
    "request_key",
    "sha256",
    "path",
    "created_by",
    "updated_by",
    "owner_id",
    "lease_id",
    "provider_id",
  ]);
  const entries = Object.entries(row).filter(
    ([k, v]) =>
      !internal.has(k) &&
      !k.endsWith("_id") &&
      k !== "assigned_to" &&
      v != null &&
      v !== "" &&
      (typeof v !== "object" || Array.isArray(v)),
  );
  return (
    <>
      <dl className="record-summary">
        {entries.map(([key, value]) => (
          <div key={key}>
            <dt>{displayLabel(key)}</dt>
            <dd
              className={
                typeof value === "number" ||
                /(reference|number|serial|sku)$/.test(key)
                  ? "numeric"
                  : undefined
              }
            >
              {["status", "stage", "outcome"].includes(key) ? (
                <StatusBadge status={String(value)} />
              ) : key.endsWith("_minor") ? (
                money(Number(value), String(row.currency || "NGN"))
              ) : key.endsWith("_bps") ? (
                `${Number(value) / 100}%`
              ) : key.endsWith("_micros") ? (
                (Number(value) / 1000000).toLocaleString("en-NG")
              ) : typeof value === "boolean" ? (
                value ? (
                  "Yes"
                ) : (
                  "No"
                )
              ) : Array.isArray(value) ? (
                value.map((v) => displayLabel(String(v))).join(", ")
              ) : /(_on|_date|_at)$/.test(key) ? (
                displayDate(String(value), key.endsWith("_at"))
              ) : key === "kind" || key === "category" ? (
                displayLabel(String(value))
              ) : (
                String(value)
              )}
            </dd>
          </div>
        ))}
        {refs.map(([key]) => (
          <div key={key}>
            <dt>{displayLabel(key)}</dt>
            <dd>
              {names[key]?.entity === "person" ? (
                names[key].label
              ) : names[key] ? (
                <RecordLink
                  entity={names[key].entity}
                  id={names[key].id}
                  kind={names[key].kind}
                >
                  {names[key].label}
                </RecordLink>
              ) : (
                "Record unavailable"
              )}
            </dd>
          </div>
        ))}
        {Boolean(row.evidence_id) && (
          <div>
            <dt>Supporting evidence</dt>
            <dd>
              <a
                href={
                  "/api/business/file?id=" +
                  encodeURIComponent(String(row.evidence_id))
                }
              >
                View evidence ↗
              </a>
            </dd>
          </div>
        )}
      </dl>
      <details className="record-references">
        <summary>Technical references</summary>
        <dl className="record-summary">
          {Object.entries(row)
            .filter(([k, v]) => (k === "id" || k.endsWith("_id")) && v)
            .map(([k, v]) => (
              <div key={k}>
                <dt>{displayLabel(k)}</dt>
                <dd className="document-reference">{String(v)}</dd>
              </div>
            ))}
        </dl>
      </details>
    </>
  );
}
