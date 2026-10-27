"use client";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/client";
import {
  Fields,
  Summary,
  field,
  ref,
  initialValues,
  payloadValues,
  type FieldDef,
} from "./business-fields";
import { businessDate, type Area, type Row } from "@/lib/business";
import type { BusinessConfig } from "./BusinessWorkspace";
import { mayLeave, useUnsavedChanges } from "@/lib/unsaved";
import { workspaceLocation } from "@/lib/workspace-navigation";
const reason = field(
  "reason",
  "Decision / correction reason",
  "textarea",
  true,
);
const evidence = (area: Area, required = true): FieldDef => ({
  key: "evidence_id",
  label: "Supporting evidence",
  type: "evidence",
  area,
  required,
});
const quantity = field("quantity", "Quantity", "number", true);
type Module = {
  ownerOnly?: boolean;
  entity: string;
  label: string;
  area: Area;
  action?: string;
  fields?: FieldDef[];
  editable?: boolean;
  description: string;
};
const modules: Module[] = [
  {
    entity: "approval_rules",
    label: "Approval routing rules",
    ownerOnly: true,
    area: "finance",
    action: "approval-rule",
    editable: true,
    description:
      "Approval is always required. An optional threshold adds a named approver or owner above that amount; it never permits automatic spending. Leave the threshold blank until the owner decides the limits.",
    fields: [
      field("kind", "Action", "select", true, [
        "purchase",
        "discount",
        "credit",
        "refund",
      ]),
      field("currency", "Currency", "select", true, [
        "NGN",
        "USD",
        "GBP",
        "EUR",
      ]),
      field(
        "threshold_minor",
        "Additional approval threshold (leave blank if undecided)",
        "money",
      ),
      field("approver_id", "Designated approver (blank means owner)", "person"),
      field("notes", "Approval policy notes", "textarea"),
    ],
  },
  {
    entity: "shipments",
    label: "Inbound shipments",
    area: "procurement",
    action: "shipment",
    editable: true,
    description:
      "Track supplier shipments and expected arrivals. Marking arrival does not add stock; receiving still requires a separate stock transaction.",
    fields: [
      ref("purchase_line_id", "Purchase line", "commercial_lines", true),
      quantity,
      field("status", "Shipment status", "select", true, [
        "planned",
        "shipped",
        "arrived",
        "delayed",
        "returned",
        "cancelled",
      ]),
      field("carrier", "Carrier"),
      field("tracking_reference", "Tracking reference"),
      field("shipped_on", "Actual shipment date", "date"),
      field("expected_on", "Expected arrival", "date"),
      field("notes", "Shipment notes", "textarea"),
      evidence("procurement", false),
    ],
  },
  {
    entity: "cases",
    label: "Service response clocks",
    area: "support",
    description:
      "Pause an agreed first-response clock only with customer-approved evidence. Resuming preserves remaining working minutes. A missed target cannot be cleared by pausing.",
  },
  {
    entity: "acceptance_requests",
    label: "Customer acceptance requests",
    area: "sales",
    action: "acceptance-request",
    description:
      "Request evidence against an explicitly shared issued document. Customers upload only through their own portal. Withdraw requests when no longer needed.",
    fields: [
      ref("customer_id", "Customer", "customers", true),
      ref("share_id", "Approved document share", "portal_shares", true),
      field(
        "prompt",
        "What evidence should the customer provide?",
        "textarea",
        true,
      ),
    ],
  },
  {
    entity: "portal_evidence",
    label: "Customer evidence uploads",
    area: "sales",
    description:
      "Private customer-uploaded acceptance evidence. Downloads are authorized against the customer record.",
  },
  {
    entity: "locations",
    label: "Stock locations",
    area: "inventory",
    action: "location",
    editable: true,
    description:
      "Maintain actual storage locations. Archived locations cannot receive new stock movements.",
    fields: [
      field("name", "Location name", "text", true),
      field("archived", "Archived", "checkbox"),
    ],
  },
  {
    entity: "inspections",
    label: "Purchasing inspections",
    area: "procurement",
    action: "inspection",
    description:
      "Record checks and discrepancies. Rejected inspections quarantine future receipts; place existing received stock on hold separately.",
    fields: [
      ref("purchase_id", "Purchase order", "commercial", true, "purchase"),
      ref("line_id", "Purchase line (optional)", "commercial_lines"),
      field("stage", "Inspection stage", "select", true, [
        "pre-shipment",
        "receiving",
        "discrepancy",
      ]),
      field("result", "Inspection result", "select", true, [
        "pending",
        "accepted",
        "rejected",
      ]),
      quantity,
      field("notes", "Checks and discrepancies", "textarea", true),
      evidence("procurement"),
    ],
  },
  {
    entity: "stock_holds",
    label: "Stock quarantine",
    area: "inventory",
    action: "stock-hold",
    description:
      "Quarantined quantities cannot be reserved or dispatched. Release requires inventory approval and a recorded reason.",
    fields: [
      ref("movement_id", "Incoming stock movement", "stock", true),
      quantity,
      reason,
      evidence("inventory", false),
    ],
  },
  {
    entity: "order_progress",
    label: "Order fulfilment",
    area: "sales",
    action: "order-progress",
    editable: true,
    description:
      "Track fulfilment separately from invoices and payment. Completion requires customer acceptance and resolution of outstanding delivery quantities.",
    fields: [
      ref("order_id", "Sales order", "commercial", true, "order"),
      field("status", "Fulfilment stage", "select", true, [
        "approved",
        "in_progress",
        "fulfilled",
        "closed",
      ]),
      field("delivery_address", "Delivery destination", "textarea"),
      field("receiver", "Customer receiver / acceptance name"),
      evidence("sales", false),
      reason,
    ],
  },
  {
    entity: "order_cancellations",
    label: "Order quantity changes",
    area: "sales",
    action: "cancel-quantity",
    description:
      "Approved quantity reductions retain the original agreement and evidence. Already billed or delivered quantities cannot be cancelled here.",
    fields: [
      ref("line_id", "Sales order line", "commercial_lines", true),
      quantity,
      reason,
      evidence("sales"),
    ],
  },
  {
    entity: "maintenance_visits",
    label: "Maintenance visits",
    area: "support",
    action: "visit",
    editable: true,
    description:
      "Schedule engineer visits and link covered customer equipment. Completed visits require dated evidence.",
    fields: [
      ref("case_id", "Maintenance contract", "cases", true, "maintenance"),
      ref("asset_id", "Covered equipment", "assets"),
      field("assigned_to", "Assigned engineer", "person"),
      {
        ...field("scheduled_on", "Visit date", "date", true),
        default: businessDate(),
      },
      field("status", "Visit status", "select", true, [
        "scheduled",
        "completed",
        "cancelled",
      ]),
      field("completed_on", "Completed on", "date"),
      field("notes", "Coverage / visit report", "textarea"),
      evidence("support", false),
    ],
  },
  {
    entity: "supplier_bank",
    label: "Supplier payment details",
    area: "finance",
    action: "supplier-bank",
    description:
      "Propose verified supplier bank details, then obtain independent approval. The owner can explicitly record a same-person exception. Account numbers are masked in lists.",
    fields: [
      ref("supplier_id", "Supplier", "suppliers", true),
      field("bank_name", "Bank name", "text", true),
      field("account_name", "Account name", "text", true),
      field("account_number", "Account number / IBAN", "text", true),
      field("currency", "Currency", "select", true, [
        "NGN",
        "USD",
        "GBP",
        "EUR",
      ]),
      evidence("finance"),
      reason,
    ],
  },
  {
    entity: "cost_allocations",
    label: "Landed cost allocations",
    area: "finance",
    action: "cost-allocation",
    description:
      "Allocate approved shipping, insurance or other expenses to purchase lines in the same currency. Record the basis; allocations cannot exceed the source expense.",
    fields: [
      ref("expense_id", "Approved expense", "expenses", true),
      ref("purchase_line_id", "Purchase line", "commercial_lines", true),
      field("amount_minor", "Allocated cost", "money", true),
      field(
        "basis",
        "Allocation basis (quantity, value, weight or agreed method)",
        "textarea",
        true,
      ),
    ],
  },
  {
    entity: "supplier_payments",
    label: "Supplier payment corrections",
    area: "finance",
    description:
      "Keep original payment evidence and record approved reversals. Unmatch bank reconciliation before reversing a payment.",
  },
  {
    entity: "bank_lines",
    label: "Outgoing bank matching",
    area: "finance",
    description:
      "Match negative statement lines to existing supplier payments or refunds. No payment or bank transfer is created.",
  },
  {
    entity: "messages",
    label: "Dispatch review & retries",
    area: "sales",
    description:
      "Review recipient and linked records, pause pending messages or retry within the provider safety window. Sent messages cannot be replayed.",
  },
];
export default function OperationsDesk() {
  const [query, setQuery] = useState(""),
    [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [config, setConfig] = useState<BusinessConfig | null>(null),
    [module, setModule] = useState(modules[0]),
    [rows, setRows] = useState<Row[]>([]),
    [page, setPage] = useState(0),
    [more, setMore] = useState(false),
    [selected, setSelected] = useState<Row | null>(null),
    [form, setForm] = useState<{ action: string; fields: FieldDef[] } | null>(
      null,
    ),
    [values, setValues] = useState<Record<string, unknown>>({}),
    [key, setKey] = useState(""),
    [dirty, setDirty] = useState(false),
    [busy, setBusy] = useState(false),
    [feedback, setFeedback] = useState(""),
    [error, setError] = useState("");
  const generation = useRef(0);
  const locationReady = useRef(false);
  useUnsavedChanges(dirty);
  useEffect(() => {
    api<BusinessConfig>("business/config")
      .then((c) => {
        setConfig(c);
        setModule(
          modules.find(
            (m) =>
              m.entity ===
                new URLSearchParams(location.search).get("control") &&
              c.access[m.area]?.read &&
              (!m.ownerOnly || c.owner),
          ) ||
            modules.find(
              (m) => c.access[m.area]?.read && (!m.ownerOnly || c.owner),
            ) ||
            modules[0],
        );
      })
      .catch((e) => setError(e.message));
  }, []);
  const load = async () => {
    const current = ++generation.current;
    const result = await api<{ rows: Row[]; more: boolean }>(
      "operations/list?entity=" +
        module.entity +
        "&page=" +
        page +
        "&query=" +
        encodeURIComponent(query) +
        "&from=" +
        from +
        "&to=" +
        to,
    );
    if (current === generation.current) {
      setRows(result.rows);
      setMore(result.more);
    }
  };
  useEffect(() => {
    if (!config) return;
    generation.current++;
    const timer = setTimeout(
      () => void load().catch((e) => setError(e.message)),
      200,
    );
    return () => {
      clearTimeout(timer);
      generation.current++;
    };
  }, [config, module, page, query, from, to]);
  useEffect(() => {
    if (config) {
      workspaceLocation({ control: module.entity }, !locationReady.current);
      locationReady.current = true;
    }
  }, [config, module]);
  const start = (
    action: string,
    fields: FieldDef[],
    record: Row | null = null,
  ) => {
    if (!mayLeave()) return;
    setSelected(record);
    setForm({ action, fields });
    setValues(initialValues(fields, record, config?.me));
    setKey(crypto.randomUUID());
    setError("");
    setFeedback("");
  };
  if (!config)
    return (
      <p role={error ? "alert" : "status"}>
        {error || "Opening operational controls…"}
      </p>
    );
  const allowed = modules.filter(
      (m) => config.access[m.area]?.read && (!m.ownerOnly || config.owner),
    ),
    approve = config.access[module.area]?.approve,
    write = config.access[module.area]?.write;
  if (!allowed.length)
    return (
      <section className="panel">
        <h2>Operational controls</h2>
        <p>The owner can grant access to the business modules you need.</p>
      </section>
    );
  return (
    <>
      <section className="panel">
        <label className="field">
          <span id="operational-area-label">Operational area</span>
          <select
            aria-labelledby="operational-area-label"
            value={module.entity}
            onChange={(e) => {
              if (!mayLeave()) return;
              setModule(modules.find((m) => m.entity === e.target.value)!);
              setPage(0);
              setForm(null);
              setSelected(null);
              setDirty(false);
              setError("");
              setFeedback("");
            }}
          >
            {allowed.map((m) => (
              <option key={m.entity} value={m.entity}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
        <h2>{module.label}</h2>
        <p>{module.description}</p>
        {!form && (
          <>
            <div className="form-grid">
              <label className="field">
                <span>Search descriptions or exact record ID</span>
                <input
                  type="search"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setPage(0);
                  }}
                />
              </label>
              <label className="field">
                <span>Recorded from</span>
                <input
                  type="date"
                  value={from}
                  onChange={(e) => {
                    setFrom(e.target.value);
                    setPage(0);
                  }}
                />
              </label>
              <label className="field">
                <span>Recorded through</span>
                <input
                  type="date"
                  value={to}
                  min={from || undefined}
                  onChange={(e) => {
                    setTo(e.target.value);
                    setPage(0);
                  }}
                />
              </label>
            </div>
            <p>
              <a
                href={
                  "/api/operations/export?entity=" +
                  module.entity +
                  "&query=" +
                  encodeURIComponent(query) +
                  "&from=" +
                  from +
                  "&to=" +
                  to
                }
              >
                Export filtered CSV
              </a>
            </p>
          </>
        )}

        {feedback && (
          <p className="notice" role="status">
            {feedback}
          </p>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {module.action && write && !form && (
          <button onClick={() => start(module.action!, module.fields!)}>
            New record +
          </button>
        )}
      </section>
      {form ? (
        <section className="panel">
          <div className="toolbar">
            <h2>{form.action.replaceAll("-", " ")}</h2>
            <button
              className="secondary"
              onClick={() => {
                if (mayLeave()) {
                  setForm(null);
                  setDirty(false);
                }
              }}
            >
              Back to list
            </button>
          </div>
          {module.entity === "supplier_bank" && selected && (
            <div className="ops-gap">
              <p>
                Verify these details against the supplier’s approved evidence
                before confirming.
              </p>
              <button
                className="secondary"
                onClick={async () => {
                  try {
                    setSelected(
                      await api<Row>(
                        "operations/bank-review?id=" + selected.id,
                      ),
                    );
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }}
              >
                Reveal bank details for review
              </button>
              <Summary row={selected} />
            </div>
          )}
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError("");
              try {
                await api("operations/command", {
                  action: form.action,
                  id: selected?.id || "",
                  version: selected?.version || 0,
                  request_key: key,
                  data: {
                    ...payloadValues(form.fields, values),
                    ...(form.action === "approval-rule"
                      ? {
                          threshold_minor:
                            values.threshold_minor === ""
                              ? ""
                              : payloadValues(form.fields, values)
                                  .threshold_minor,
                        }
                      : {}),
                  },
                });
                setDirty(false);
                setForm(null);
                setSelected(null);
                setFeedback(
                  "Recorded successfully. Original records and evidence remain traceable.",
                );
                await load();
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <Fields
              fields={form.fields}
              values={values}
              people={config.people}
              disabled={busy}
              onChange={(k, v) => {
                setValues((s) => ({ ...s, [k]: v }));
                setDirty(true);
              }}
            />
            <button disabled={busy}>
              {busy ? "Saving…" : "Confirm and save"}
            </button>
          </form>
        </section>
      ) : (
        <section className="panel">
          {rows.length === 0 ? (
            <p>No records yet.</p>
          ) : (
            rows.map((r) => (
              <details className="operation-record" key={r.id}>
                <summary>
                  {String(
                    r.name ||
                      r.reference ||
                      r.subject ||
                      r.status ||
                      module.label,
                  )}{" "}
                  <small>{String(r.created_at || "").slice(0, 10)}</small>
                </summary>
                <Summary row={r} />
                <div className="actions">
                  {module.entity === "portal_evidence" &&
                    r.status === "complete" && (
                      <a href={"/api/operations/portal-evidence?id=" + r.id}>
                        Download evidence
                      </a>
                    )}
                  {module.entity === "acceptance_requests" &&
                    r.status !== "withdrawn" &&
                    write && (
                      <button
                        className="secondary"
                        onClick={() =>
                          start("withdraw-acceptance", [reason], r)
                        }
                      >
                        Withdraw request
                      </button>
                    )}
                  {module.entity === "cases" && approve && (
                    <>
                      <button
                        onClick={() =>
                          start(
                            "pause-clock",
                            [
                              reason,
                              evidence(
                                r.kind === "project" ? "projects" : "support",
                              ),
                            ],
                            r,
                          )
                        }
                      >
                        Approve clock pause
                      </button>
                      <button
                        className="secondary"
                        onClick={() =>
                          start(
                            "resume-clock",
                            [
                              reason,
                              evidence(
                                r.kind === "project" ? "projects" : "support",
                              ),
                            ],
                            r,
                          )
                        }
                      >
                        Resume response clock
                      </button>
                    </>
                  )}
                  {module.editable && write && (
                    <button
                      className="secondary"
                      onClick={() => start(module.action!, module.fields!, r)}
                    >
                      Update record
                    </button>
                  )}
                  {module.entity === "stock_holds" &&
                    !r.released_at &&
                    approve && (
                      <button
                        onClick={() => start("release-hold", [reason], r)}
                      >
                        Approve release
                      </button>
                    )}
                  {module.entity === "supplier_bank" &&
                    r.status === "pending" &&
                    approve && (
                      <button
                        onClick={() =>
                          start(
                            "approve-bank",
                            [
                              reason,
                              field(
                                "owner_exception",
                                "Explicit owner exception if approving your own proposal",
                                "checkbox",
                              ),
                            ],
                            r,
                          )
                        }
                      >
                        Review bank change
                      </button>
                    )}
                  {module.entity === "supplier_payments" &&
                    !r.reversed_at &&
                    approve && (
                      <button
                        className="secondary danger"
                        onClick={() =>
                          start(
                            "reverse-supplier-payment",
                            [reason, evidence("finance")],
                            r,
                          )
                        }
                      >
                        Record payment reversal
                      </button>
                    )}
                  {module.entity === "bank_lines" &&
                    write &&
                    !(r.payment_id || r.supplier_payment_id || r.refund_id) &&
                    Number(r.amount_minor) < 0 && (
                      <button
                        onClick={() =>
                          start(
                            "match-outgoing",
                            [
                              ref(
                                "supplier_payment_id",
                                "Supplier payment (choose one outgoing type)",
                                "supplier_payments",
                              ),
                              ref(
                                "refund_id",
                                "Customer refund (choose one outgoing type)",
                                "refunds",
                              ),
                            ],
                            r,
                          )
                        }
                      >
                        Match outgoing payment
                      </button>
                    )}
                  {module.entity === "bank_lines" &&
                    approve &&
                    !!(
                      r.payment_id ||
                      r.supplier_payment_id ||
                      r.refund_id
                    ) && (
                      <button
                        className="secondary"
                        onClick={() => start("unmatch-bank", [reason], r)}
                      >
                        Correct bank match
                      </button>
                    )}
                  {module.entity === "messages" &&
                    write &&
                    !["sent", "cancelled"].includes(String(r.status)) && (
                      <>
                        {!r.paused ? (
                          <button
                            className="secondary"
                            onClick={() => start("pause-message", [reason], r)}
                          >
                            Pause dispatch
                          </button>
                        ) : (
                          <button
                            onClick={() => start("resume-message", [reason], r)}
                          >
                            Resume dispatch
                          </button>
                        )}
                        {r.status === "failed" && (
                          <button
                            onClick={() => start("replay-message", [reason], r)}
                          >
                            Retry safely
                          </button>
                        )}
                        <button
                          className="secondary danger"
                          onClick={() => start("cancel-message", [reason], r)}
                        >
                          Cancel message
                        </button>
                      </>
                    )}
                </div>
              </details>
            ))
          )}
          <div className="pagination">
            <button
              className="secondary"
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </button>
            <span>Page {page + 1}</span>
            <button
              className="secondary"
              disabled={!more}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
        </section>
      )}
    </>
  );
}
