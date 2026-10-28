"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, saveFile } from "@/lib/client";
import { money } from "@/lib/contracts";
import {
  type Access,
  type Area,
  type Entity,
  type Master,
  type Row,
  type CommercialKind,
  businessDate,
  commercialArea,
} from "@/lib/business";
import { mayLeave, useUnsavedChanges } from "@/lib/unsaved";
import { workspaceLocation } from "@/lib/workspace-navigation";
import {
  Fields,
  Summary,
  masterFields,
  paymentFields,
  expenseFields,
  initialValues,
  payloadValues,
  field,
  ref,
  type FieldDef,
} from "./business-fields";
import CommercialEditor from "./business-commercial";
import CustomerImport from "./CustomerImport";
import BusinessReceiptViewer from "./BusinessReceiptViewer";
import BusinessDelivery from "./BusinessDelivery";
import BusinessQuoteEditor from "./BusinessQuoteEditor";
import CustomerStatement from "./CustomerStatement";
import { workspaceTools } from "@/lib/workspace-areas";
export type BusinessConfig = {
  owner?: boolean;
  legacy_documents?: boolean;
  me: string;
  access: Access;
  people: { id: string; name: string }[];
};
type Resource = {
  entity: Entity;
  label: string;
  area: Area;
  kind?: string;
  master?: Master;
};
const resources: Resource[] = [
  {
    entity: "customers",
    label: "Customers",
    area: "sales",
    master: "customers",
  },
  {
    entity: "enquiries",
    label: "Enquiries",
    area: "sales",
    master: "enquiries",
  },
  {
    entity: "contacts",
    label: "Customer contacts",
    area: "sales",
    master: "contacts",
  },
  {
    entity: "opportunities",
    label: "Opportunities",
    area: "sales",
    master: "opportunities",
  },
  { entity: "quotes", label: "Quotation acceptance", area: "sales" },
  { entity: "commercial", label: "Sales orders", area: "sales", kind: "order" },
  {
    entity: "commercial",
    label: "Sales invoices",
    area: "finance",
    kind: "invoice",
  },
  {
    entity: "commercial",
    label: "Credit notes",
    area: "finance",
    kind: "credit",
  },
  { entity: "payments", label: "Customer payments", area: "finance" },
  { entity: "allocations", label: "Payment allocations", area: "finance" },
  { entity: "refunds", label: "Refunds", area: "finance" },
  { entity: "expenses", label: "Bills & expenses", area: "finance" },
  { entity: "supplier_payments", label: "Supplier payments", area: "finance" },
  { entity: "bank_lines", label: "Bank reconciliation", area: "finance" },
  {
    entity: "suppliers",
    label: "Suppliers",
    area: "procurement",
    master: "suppliers",
  },
  {
    entity: "commercial",
    label: "Supplier RFQs",
    area: "procurement",
    kind: "rfq",
  },
  {
    entity: "commercial",
    label: "Purchase orders",
    area: "procurement",
    kind: "purchase",
  },
  {
    entity: "items",
    label: "Equipment & service catalogue",
    area: "inventory",
    master: "items",
  },
  { entity: "offers", label: "Supplier offer comparison", area: "procurement" },
  { entity: "stock", label: "Stock movements", area: "inventory" },
  { entity: "reservations", label: "Stock reservations", area: "inventory" },
  {
    entity: "commercial",
    label: "Delivery notes",
    area: "inventory",
    kind: "delivery",
  },
  {
    entity: "assets",
    label: "Customer equipment & warranty",
    area: "inventory",
  },
  {
    entity: "cases",
    label: "Projects",
    area: "projects",
    kind: "project",
    master: "cases",
  },
  {
    entity: "cases",
    label: "Support tickets",
    area: "support",
    kind: "ticket",
    master: "cases",
  },
  {
    entity: "cases",
    label: "Maintenance contracts",
    area: "support",
    kind: "maintenance",
    master: "cases",
  },
  {
    entity: "tasks",
    label: "Tasks & milestones",
    area: "projects",
    master: "tasks",
  },
  { entity: "messages", label: "Business messages", area: "sales" },
  { entity: "decisions", label: "Approval history", area: "finance" },
  { entity: "portal_members", label: "Customer portal access", area: "sales" },
  {
    entity: "portal_shares",
    label: "Shared customer documents",
    area: "sales",
  },
  { entity: "portal_events", label: "Customer portal activity", area: "sales" },
];
export function BusinessDashboard({ onOpen }: { onOpen?: () => void }) {
  const [data, setData] = useState<Record<string, unknown> | null>(null),
    [error, setError] = useState(""),
    [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [owner, setOwner] = useState(""),
    [service, setService] = useState(""),
    [people, setPeople] = useState<{ id: string; name: string }[]>([]);
  useEffect(() => {
    api<BusinessConfig>("business/config")
      .then((c) => setPeople(c.people))
      .catch(() => {});
  }, []);
  useEffect(() => {
    let active = true;
    api<Record<string, unknown>>(
      "business/dashboard?from=" +
        from +
        "&to=" +
        to +
        "&owner=" +
        owner +
        "&service=" +
        service,
    )
      .then((d) => {
        if (active) {
          setData(d);
          setError("");
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [from, to, owner, service]);
  return (
    <section className="panel">
      <div className="toolbar">
        <div>
          <p className="eyebrow">Supply. Build. Connect.</p>
          <h2>Your business at a glance</h2>
        </div>
        {onOpen && <button onClick={onOpen}>View sales workspace ↗</button>}
      </div>
      <div className="form-grid">
        <label className="field">
          <span>Work assigned to</span>
          <select value={owner} onChange={(e) => setOwner(e.target.value)}>
            <option value="">All permitted colleagues</option>
            {people.map((p) => (
              <option value={p.id} key={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Enquiry / work service</span>
          <select value={service} onChange={(e) => setService(e.target.value)}>
            <option value="">All services</option>
            {[
              "procurement",
              "hardware",
              "consulting",
              "installation-labs",
              "ai-automation",
              "software",
              "data",
              "cloud-integration",
            ].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Period from</span>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label className="field">
          <span>Period to</span>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
      </div>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {data ? (
        <>
          <div className="stat-grid">
            {[
              ["Open enquiries", "enquiries_open"],
              ["Follow-ups due", "followups_due"],
              ["Active projects", "projects_active"],
              ["Open tickets", "tickets_open"],
              ["Tasks due", "tasks_due"],
            ].map(([label, k]) => (
              <article className="stat" key={k}>
                <span>{label}</span>
                <strong>{Number(data[k] || 0)}</strong>
              </article>
            ))}
          </div>
          <div className="table-scroll">
            <table>
              <caption>Financial totals by currency</caption>
              <thead>
                <tr>
                  <th>Currency</th>
                  <th>Invoiced</th>
                  <th>Received</th>
                  <th>Refunded</th>
                  <th>Outstanding</th>
                  <th>Overdue</th>
                  <th>Approved expenses</th>
                </tr>
              </thead>
              <tbody>
                {((data.currency_totals || []) as Row[]).map((r, i) => (
                  <tr key={i}>
                    <th>{String(r.currency)}</th>
                    {[
                      "invoiced_minor",
                      "received_minor",
                      "refunded_minor",
                      "outstanding_minor",
                      "overdue_minor",
                      "expenses_minor",
                    ].map((k) => (
                      <td key={k}>{money(Number(r[k]), String(r.currency))}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="muted">
            Colleague/service filters apply to work queues. Period filters apply
            to invoices, cash records, refunds and expenses. Outstanding
            balances and work queues are current. Amounts reflect your access.
            Invoiced sales are separate from cash received.
          </p>
        </>
      ) : (
        !error && <p role="status">Loading business totals…</p>
      )}
    </section>
  );
}
export function EntryForm({
  title,
  fields,
  initial,
  config,
  submit,
  onBack,
  button = "Save record",
  extra,
}: {
  title: string;
  fields: FieldDef[];
  initial?: Row | null;
  config: BusinessConfig;
  submit: (v: Record<string, unknown>, requestKey: string) => Promise<void>;
  onBack: () => void;
  button?: string;
  extra?: React.ReactNode;
}) {
  const [requestKey] = useState(() => crypto.randomUUID());
  const [values, setValues] = useState(() =>
      initialValues(fields, initial, config.me),
    ),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [dirty, setDirty] = useState(false);
  useUnsavedChanges(dirty);
  return (
    <section className="panel">
      <div className="toolbar">
        <h2>{title}</h2>
        <button
          className="secondary"
          onClick={() => {
            if (mayLeave()) onBack();
          }}
        >
          Back
        </button>
      </div>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            await submit(payloadValues(fields, values), requestKey);
            setDirty(false);
          } catch (err) {
            setError((err as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <Fields
          fields={fields}
          values={values}
          people={config.people}
          disabled={busy}
          onChange={(k, v) => {
            setValues((s) => ({ ...s, [k]: v }));
            setDirty(true);
          }}
        />
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <div className="actions">
          <button disabled={busy}>{busy ? "Saving…" : button}</button>
        </div>
      </form>
      {extra}
    </section>
  );
}
export default function BusinessWorkspace({
  onOpenDocument,
  department,
}: {
  department?: string;
  onOpenDocument: (id?: string) => void;
}) {
  const locationReady = useRef(false);
  const [restored, setRestored] = useState(false);
  const [quotationId, setQuotationId] = useState("");
  const [receiptId, setReceiptId] = useState("");
  const [config, setConfig] = useState<BusinessConfig | null>(null),
    [resource, setResource] = useState<Resource>(resources[0]),
    [rows, setRows] = useState<Row[]>([]),
    [selected, setSelected] = useState<Row | null | undefined>(undefined),
    [query, setQuery] = useState(""),
    [filterOwner, setFilterOwner] = useState(""),
    [filterService, setFilterService] = useState(""),
    [filterFrom, setFilterFrom] = useState(""),
    [filterTo, setFilterTo] = useState(""),
    [page, setPage] = useState(0),
    [more, setMore] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [action, setAction] = useState<{
      title: string;
      fields: FieldDef[];
      endpoint: string;
      fixed?: Record<string, unknown>;
      nested?: boolean;
    } | null>(null),
    [special, setSpecial] = useState<
      "stock" | "reserve" | "asset" | "grant" | null
    >(null),
    [seedSource, setSeedSource] = useState("");
  const load = useCallback(async () => {
    setBusy(true);
    try {
      const r = await api<{ rows: Row[]; more: boolean }>("business/list", {
        entity: resource.entity,
        kind: resource.kind || "",
        query,
        page,
        parent: "",
        status: "",
        owner: filterOwner,
        service: filterService,
        from: filterFrom,
        to: filterTo,
      });
      setRows(r.rows);
      setMore(r.more);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [resource, query, page, filterOwner, filterService, filterFrom, filterTo]);
  useEffect(() => {
    let active = true;
    api<BusinessConfig>("business/config")
      .then((c) => {
        if (active) {
          setConfig(c);
          const first = resources.find(
            (r) =>
              c.access[r.area]?.read ||
              (r.entity === "tasks" && c.access.support?.read),
          );
          if (first) setResource(first);
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (!config) return;
    const t = setTimeout(() => void load(), 200);
    return () => clearTimeout(t);
  }, [config, load]);
  useEffect(() => {
    if (!config) return;
    let active = true;
    const params = new URLSearchParams(location.search);
    const target = resources.find(
      (r) =>
        r.entity === params.get("module") &&
        (!r.kind || r.kind === params.get("kind")) &&
        (config.access[r.area]?.read ||
          (r.entity === "tasks" && config.access.support?.read)),
    );
    if (target) setResource(target);
    const id = params.get("record");
    if (target && id && id !== "new") {
      api<{ record: Row }>(
        "business/detail?entity=" +
          target.entity +
          "&id=" +
          encodeURIComponent(id),
      )
        .then((r) => {
          if (active) setSelected(r.record);
        })
        .catch((e) => {
          if (active) setError(e.message);
        })
        .finally(() => {
          if (active) setRestored(true);
        });
    } else {
      if (target && id === "new") setSelected(null);
      setRestored(true);
    }
    return () => {
      active = false;
    };
  }, [config]);
  useEffect(() => {
    if (!config || !restored) return;
    workspaceLocation(
      {
        module: resource.entity,
        kind: resource.kind || null,
        record: selected === null ? "new" : selected?.id || null,
      },
      !locationReady.current,
    );
    locationReady.current = true;
  }, [resource, selected, config, restored]);
  const move = (r: Resource) => {
    if (!mayLeave()) return;
    setResource(r);
    setSelected(undefined);
    setAction(null);
    setQuery("");
    setPage(0);
    setNotice("");
    setSeedSource("");
  };
  const done = async (message = "Saved successfully.") => {
    setSelected(undefined);
    setAction(null);
    setSpecial(null);
    setNotice(message);
    await load();
  };
  const act = (
    title: string,
    fields: FieldDef[],
    endpoint: string,
    fixed: Record<string, unknown> = {},
    nested = false,
  ) => setAction({ title, fields, endpoint, fixed, nested });
  if (receiptId)
    return (
      <BusinessReceiptViewer id={receiptId} onBack={() => setReceiptId("")} />
    );
  if (quotationId)
    return (
      <BusinessQuoteEditor
        id={quotationId}
        onBack={() => {
          setQuotationId("");
          void load();
        }}
      />
    );
  if (!config)
    return (
      <section className="panel">
        <p role={error ? "alert" : "status"}>
          {error || "Opening business operations…"}
        </p>
      </section>
    );
  const allowed = resources.filter(
    (r) =>
      (r.entity !== "portal_members" || config.owner) &&
      (config.access[r.area]?.read ||
        (r.entity === "tasks" && config.access.support?.read)) &&
      (!department ||
        workspaceTools.some(
          (t) =>
            t.department === department &&
            t.section === "operations" &&
            t.params?.module === r.entity &&
            (t.params?.kind || "") === (r.kind || ""),
        )),
  );
  if (!allowed.length)
    return (
      <section className="panel">
        <h2>Business operations</h2>
        <p>
          Your account has no business module permissions. Your existing
          website, card and account tools remain available. The owner can assign
          business capabilities.
        </p>
      </section>
    );
  const writable =
    config.access[resource.area]?.write ||
    (resource.entity === "tasks" && config.access.support?.write);
  if (action)
    return (
      <EntryForm
        key={action.title}
        title={action.title}
        fields={action.fields}
        config={config}
        button="Confirm and save"
        onBack={() => setAction(null)}
        submit={async (values, requestKey) => {
          const body = action.nested
            ? {
                ...action.fixed,
                data: {
                  ...((action.fixed?.data as Record<string, unknown>) || {}),
                  ...values,
                },
                request_key: requestKey,
              }
            : { ...values, ...action.fixed, request_key: requestKey };
          await api("business/" + action.endpoint, body);
          await done();
        }}
      />
    );
  if (selected !== undefined && resource.entity === "commercial")
    return (
      <CommercialEditor
        key={selected?.id || "new" + resource.kind + seedSource}
        record={selected}
        kind={resource.kind as CommercialKind}
        access={config.access}
        initialSource={seedSource}
        onConvert={(kind, id) => {
          const target = resources.find(
            (r) => r.entity === "commercial" && r.kind === kind,
          );
          if (target) {
            setResource(target);
            setSeedSource(id);
            setSelected(null);
          }
        }}
        onBack={() => setSelected(undefined)}
        onSaved={(r) => {
          setSelected(r);
          void load();
        }}
      />
    );
  if (selected !== undefined && resource.master && writable)
    return (
      <EntryForm
        key={selected?.id || "new" + resource.entity}
        title={(selected ? "Edit " : "New ") + resource.label.toLowerCase()}
        fields={masterFields[resource.master].filter(
          (f) => resource.entity !== "cases" || f.key !== "kind",
        )}
        initial={selected || { id: "", kind: resource.kind }}
        config={config}
        onBack={() => setSelected(undefined)}
        submit={async (values, requestKey) => {
          if (!writable) throw new Error("Editing is not permitted.");
          const data =
            resource.entity === "cases"
              ? { ...values, kind: resource.kind }
              : values;
          await api("business/save", {
            request_key: requestKey,
            entity: resource.master,
            ...(selected ? { id: selected.id } : {}),
            version: selected?.version || 0,
            data,
          });
          await done();
        }}
        extra={
          selected && (
            <Related
              record={selected}
              resource={resource}
              config={config}
              act={act}
              onOpenDocument={(id) =>
                id ? setQuotationId(id) : onOpenDocument()
              }
            />
          )
        }
      />
    );
  if (selected === null && resource.entity === "payments")
    return (
      <EntryForm
        title="Record a customer payment"
        fields={paymentFields}
        config={config}
        onBack={() => setSelected(undefined)}
        button="Confirm payment and issue receipt"
        submit={async (data, requestKey) => {
          await api("business/payment", {
            request_key: requestKey,
            data,
          });
          await done(
            "Payment recorded with evidence and a numbered receipt. Allocate it to an invoice when appropriate.",
          );
        }}
      />
    );
  if (selected === null && resource.entity === "expenses")
    return (
      <EntryForm
        title="New bill or expense"
        fields={expenseFields}
        config={config}
        onBack={() => setSelected(undefined)}
        submit={async (data, requestKey) => {
          await api("business/expense", {
            action: "save",
            request_key: requestKey,
            data,
          });
          await done();
        }}
      />
    );
  const amount = field("amount_minor", "Amount", "money", true),
    reason = field("reason", "Reason / approval explanation", "textarea", true),
    evidence: FieldDef = {
      key: "evidence_id",
      label: "Payment evidence *",
      type: "evidence",
      area: "finance",
      required: true,
    };
  if (selected)
    return (
      <section className="panel">
        <div className="toolbar">
          <h2>
            {String(
              selected.number ||
                selected.reference ||
                selected.name ||
                selected.title ||
                resource.label,
            )}
          </h2>
          <button className="secondary" onClick={() => setSelected(undefined)}>
            Back to list
          </button>
        </div>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <Summary row={selected} />
        <div className="actions ops-gap">
          {resource.entity === "offers" &&
            config.access.procurement.approve && (
              <button
                onClick={() =>
                  act(
                    "Select supplier offer",
                    [
                      field(
                        "reason",
                        "Selection reason: price, timing, inspection and warranty",
                        "textarea",
                        true,
                      ),
                    ],
                    "offer",
                    { action: "select", id: selected.id },
                  )
                }
              >
                Select this supplier offer
              </button>
            )}
          {resource.entity === "payments" && (
            <>
              <button
                onClick={() =>
                  act(
                    "Allocate payment",
                    [
                      ref(
                        "invoice_id",
                        "Sales invoice",
                        "commercial",
                        true,
                        "invoice",
                      ),
                      amount,
                    ],
                    "allocate",
                    { payment_id: selected.id },
                  )
                }
              >
                Allocate to invoice
              </button>
              {selected.receipt_id && (
                <button
                  className="secondary"
                  onClick={() => setReceiptId(String(selected.receipt_id))}
                >
                  Open receipt
                </button>
              )}
              {config.access.finance.approve && (
                <>
                  <button
                    className="secondary"
                    onClick={() =>
                      act(
                        "Record a refund",
                        [amount, evidence, reason],
                        "finance-action",
                        { action: "refund", payment_id: selected.id },
                      )
                    }
                  >
                    Record refund
                  </button>
                  {!selected.customer_id && (
                    <button
                      className="secondary"
                      onClick={() =>
                        act(
                          "Link existing payment to customer",
                          [
                            ref(
                              "customer_id",
                              "Reviewed customer",
                              "customers",
                              true,
                            ),
                          ],
                          "finance-action",
                          { action: "link_legacy", id: selected.id },
                        )
                      }
                    >
                      Link legacy payment
                    </button>
                  )}
                </>
              )}
            </>
          )}
          {resource.entity === "bank_lines" &&
            !selected.payment_id &&
            !selected.supplier_payment_id &&
            !selected.refund_id &&
            Number(selected.amount_minor) > 0 && (
              <button
                onClick={() =>
                  act(
                    "Match bank line to recorded payment",
                    [
                      ref(
                        "payment_id",
                        "Confirmed customer payment",
                        "payments",
                        true,
                      ),
                    ],
                    "bank-match",
                    { id: selected.id },
                  )
                }
              >
                Match recorded payment
              </button>
            )}
          {resource.entity === "allocations" &&
            config.access.finance.approve &&
            !selected.reversed_at && (
              <button
                className="secondary danger"
                onClick={() =>
                  act("Reverse allocation", [reason], "finance-action", {
                    action: "reverse_allocation",
                    id: selected.id,
                  })
                }
              >
                Reverse allocation
              </button>
            )}
          {resource.entity === "expenses" && (
            <>
              {selected.status === "draft" && (
                <button
                  onClick={async () => {
                    try {
                      await api("business/expense", {
                        action: "submit",
                        id: selected.id,
                        version: selected.version,
                      });
                      await done();
                    } catch (e) {
                      setError((e as Error).message);
                    }
                  }}
                >
                  Submit for approval
                </button>
              )}
              {selected.status === "submitted" &&
                config.access.finance.approve &&
                (["approve", "reject"] as const).map((a) => (
                  <button
                    key={a}
                    className="secondary"
                    onClick={() =>
                      act(
                        a === "approve" ? "Approve expense" : "Reject expense",
                        [reason],
                        "expense",
                        {
                          action: a,
                          id: selected.id,
                          version: selected.version,
                        },
                      )
                    }
                  >
                    {a === "approve" ? "Approve" : "Reject"}
                  </button>
                ))}
              {selected.status === "approved" && (
                <button
                  onClick={() =>
                    act(
                      "Record supplier payment",
                      [
                        amount,
                        {
                          ...field("paid_on", "Payment date", "date", true),
                          default: businessDate(),
                        },
                        field("reference", "Payment reference"),
                        evidence,
                      ],
                      "expense",
                      { action: "pay", expense_id: selected.id },
                    )
                  }
                >
                  Record supplier payment
                </button>
              )}
            </>
          )}
          {resource.entity === "reservations" && !selected.released_at && (
            <button
              className="secondary"
              onClick={async () => {
                try {
                  await api("business/stock", {
                    action: "release",
                    id: selected.id,
                  });
                  await done();
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              Release reservation
            </button>
          )}
          {resource.entity === "quotes" && (
            <>
              <button
                className="secondary"
                onClick={() => setQuotationId(String(selected.document_id))}
              >
                Open document
              </button>
              {selected.outcome === "pending" && (
                <>
                  <button
                    onClick={() =>
                      act(
                        "Record quotation acceptance",
                        [
                          field(
                            "accepted_by",
                            "Customer acceptance name",
                            "text",
                            true,
                          ),
                          {
                            key: "evidence_id",
                            label: "Acceptance evidence *",
                            type: "evidence",
                            required: true,
                            area: "sales",
                          },
                        ],
                        "misc",
                        {
                          action: "quote_accept",
                          document_id: selected.document_id,
                        },
                      )
                    }
                  >
                    Record acceptance
                  </button>
                  <button
                    className="secondary"
                    onClick={async () => {
                      try {
                        const r = await api<{ document_id: string }>(
                          "business/misc",
                          {
                            action: "quote_revise",
                            document_id: selected.document_id,
                          },
                        );
                        setQuotationId(r.document_id);
                      } catch (e) {
                        setError((e as Error).message);
                      }
                    }}
                  >
                    Create new revision
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </section>
    );
  return (
    <>
      <div className="business-nav">
        <label className="field">
          <span>Choose a tool</span>
          <select
            aria-label="Choose a tool"
            value={resources.indexOf(resource)}
            onChange={(e) => move(resources[Number(e.target.value)])}
          >
            {allowed.map((r) => (
              <option key={resources.indexOf(r)} value={resources.indexOf(r)}>
                {r.label}
              </option>
            ))}
          </select>
        </label>
        <div className="actions">
          {(config.owner || config.legacy_documents) && (
            <button className="secondary" onClick={() => onOpenDocument()}>
              Document archive ↗
            </button>
          )}
        </div>
      </div>
      <section className="panel">
        <div className="toolbar">
          <div>
            <p className="eyebrow">Your records</p>
            <h2>{resource.label}</h2>
          </div>
          <div className="actions">
            {writable &&
              (resource.master ||
                resource.entity === "commercial" ||
                resource.entity === "payments" ||
                resource.entity === "expenses") && (
                <button onClick={() => setSelected(null)}>
                  {workspaceTools.find(
                    (t) =>
                      t.section === "operations" &&
                      t.params?.module === resource.entity &&
                      (t.params?.kind || "") === (resource.kind || ""),
                  )?.create || "Add record"}
                </button>
              )}
            {resource.entity === "stock" && writable && (
              <button
                onClick={() =>
                  act(
                    "Record stock movement",
                    [
                      ref("item_id", "Stock item", "items", true),
                      field("location", "Location", "text", true),
                      field("serial", "Serial number (serialized equipment)"),
                      ref(
                        "reverses_id",
                        "Original stock movement (returns only)",
                        "stock",
                      ),
                      {
                        ...field("quantity", "Quantity", "number", true),
                        default: 1,
                      },
                      field("kind", "Movement type", "select", true, [
                        "receive",
                        "dispatch",
                        "return",
                        "adjustment",
                      ]),
                      {
                        ...ref(
                          "movement_document_id",
                          "Purchase / delivery document",
                          "commercial",
                          false,
                        ),
                        fulfilment: true,
                      },
                      {
                        ...ref(
                          "source_line_id",
                          "Purchase / delivery line",
                          "commercial_lines",
                          false,
                        ),
                        parentKey: "movement_document_id",
                      },
                      ref(
                        "order_id",
                        "Related sales order",
                        "commercial",
                        false,
                        "order",
                      ),
                      ref(
                        "reservation_id",
                        "Reservation to fulfil",
                        "reservations",
                      ),
                      field(
                        "direction",
                        "Return / adjustment direction",
                        "select",
                        true,
                        ["in", "out"],
                      ),
                      reason,
                    ],
                    "stock",
                    { action: "move" },
                  )
                }
              >
                Record movement +
              </button>
            )}
            {resource.entity === "reservations" && writable && (
              <button
                onClick={() =>
                  act(
                    "Reserve stock",
                    [
                      ref("item_id", "Stock item", "items", true),
                      field("location", "Location", "text", true),
                      field("serial", "Serial number"),
                      {
                        ...field("quantity", "Quantity", "number", true),
                        default: 1,
                      },
                      ref(
                        "order_id",
                        "Sales order",
                        "commercial",
                        true,
                        "order",
                      ),
                    ],
                    "stock",
                    { action: "reserve" },
                  )
                }
              >
                Reserve stock +
              </button>
            )}
            {resource.entity === "assets" && writable && (
              <button
                onClick={() =>
                  act(
                    "Register installed equipment",
                    [
                      ref("customer_id", "Customer", "customers", true),
                      ref("item_id", "Equipment", "items", true),
                      ref(
                        "delivery_id",
                        "Delivery",
                        "commercial",
                        true,
                        "delivery",
                      ),
                      field("serial", "Dispatched serial number", "text", true),
                      field("site", "Installed site"),
                      field("accepted_on", "Site acceptance date", "date"),
                      field("warranty_until", "Warranty end date", "date"),
                      field("terms", "Agreed warranty terms", "textarea"),
                    ],
                    "misc",
                    { action: "asset" },
                  )
                }
              >
                Register equipment +
              </button>
            )}
            {resource.entity === "quotes" && (
              <button
                className="secondary"
                onClick={() =>
                  act(
                    "Link quotation to customer",
                    [
                      ref(
                        "document_id",
                        "Quotation / pro forma",
                        "documents",
                        true,
                      ),
                      ref("customer_id", "Customer", "customers", true),
                      ref("opportunity_id", "Opportunity", "opportunities"),
                    ],
                    "misc",
                    { action: "quote_link" },
                  )
                }
              >
                Link existing quotation
              </button>
            )}
            {resource.entity === "messages" && writable && (
              <button
                onClick={() =>
                  act(
                    "Send a customer message",
                    [
                      ref("customer_id", "Customer", "customers", true),
                      field(
                        "recipient",
                        "Recorded contact email",
                        "email",
                        true,
                      ),
                      field("subject", "Subject", "text", true),
                      field("body", "Message", "textarea", true),
                      ref(
                        "record_id",
                        "Issued order / invoice / delivery to attach",
                        "commercial",
                      ),
                      ref(
                        "document_id",
                        "Issued quotation / pro forma to attach",
                        "quotes",
                      ),
                    ],
                    "queue-message",
                  )
                }
              >
                Prepare message +
              </button>
            )}
            {resource.entity === "customers" && config.access.sales.approve && (
              <>
                <button
                  className="secondary"
                  onClick={() =>
                    act(
                      "Approve customer portal access",
                      [
                        ref("customer_id", "Customer", "customers", true),
                        field("email", "Customer email", "email", true),
                        {
                          ...field("active", "Access enabled", "checkbox"),
                          default: true,
                        },
                      ],
                      "portal-admin",
                      { action: "member" },
                    )
                  }
                >
                  Customer portal access
                </button>
                <button
                  className="secondary"
                  onClick={() =>
                    act(
                      "Share or withdraw a customer document",
                      [
                        ref("customer_id", "Customer", "customers", true),
                        ref(
                          "record_id",
                          "Order / invoice / delivery",
                          "commercial",
                        ),
                        ref(
                          "document_id",
                          "Quotation / pro forma",
                          "documents",
                        ),
                        {
                          ...field(
                            "active",
                            "Shared with customer",
                            "checkbox",
                          ),
                          default: true,
                        },
                      ],
                      "portal-admin",
                      { action: "share" },
                    )
                  }
                >
                  Share customer document
                </button>
              </>
            )}
            {resource.entity === "offers" && writable && (
              <button
                onClick={() =>
                  act(
                    "Record supplier offer",
                    [
                      ref(
                        "rfq_id",
                        "Supplier request",
                        "commercial",
                        true,
                        "rfq",
                      ),
                      ref("supplier_id", "Supplier", "suppliers", true),
                      field(
                        "amount_minor",
                        "Quoted equipment / service amount",
                        "money",
                        true,
                      ),
                      field("shipping_minor", "Shipping amount", "money"),
                      field("currency", "Currency", "select", true, [
                        "NGN",
                        "USD",
                        "GBP",
                        "EUR",
                      ]),
                      field("lead_days", "Lead time in days", "number", true),
                      field(
                        "terms",
                        "Inspection, warranty and delivery terms",
                        "textarea",
                      ),
                      {
                        key: "evidence_id",
                        label: "Supplier quotation evidence",
                        type: "evidence",
                        required: true,
                        area: "procurement",
                      },
                    ],
                    "offer",
                    { action: "save" },
                  )
                }
              >
                Add supplier offer +
              </button>
            )}
            {resource.entity === "customers" && config.owner && (
              <button
                className="secondary"
                onClick={() =>
                  act(
                    "Merge reviewed customer records",
                    [
                      ref(
                        "source_id",
                        "Duplicate customer to archive",
                        "customers",
                        true,
                      ),
                      ref("target_id", "Customer to keep", "customers", true),
                      field(
                        "reason",
                        "Why these are the same customer",
                        "textarea",
                        true,
                      ),
                      field(
                        "reviewed",
                        "I reviewed both records; customer portal access will be disabled until reviewed again",
                        "checkbox",
                        true,
                      ),
                    ],
                    "customer-merge",
                  )
                }
              >
                Merge duplicates
              </button>
            )}
            <button
              className="secondary"
              disabled={busy}
              onClick={() => void load()}
            >
              Refresh
            </button>
          </div>
        </div>
        {notice && (
          <p className="notice" role="status">
            {notice}
          </p>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <div className="toolbar ops-gap">
          <label className="field">
            <span>Search {resource.label.toLowerCase()}</span>
            <input
              type="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(0);
              }}
              placeholder="Name, title or reference"
            />
          </label>
          <button
            className="secondary"
            onClick={async () => {
              try {
                await saveFile("business/csv", {
                  entity: resource.entity,
                  kind: resource.kind || "",
                  query,
                  page: 0,
                  parent: "",
                  status: "",
                  owner: filterOwner,
                  service: filterService,
                  from: filterFrom,
                  to: filterTo,
                });
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            Export filtered CSV
          </button>
        </div>
        <details className="operation-record">
          <summary>Filter by date, colleague or service</summary>
          <div className="form-grid">
            {[
              "customers",
              "enquiries",
              "opportunities",
              "commercial",
              "cases",
              "tasks",
            ].includes(resource.entity) && (
              <label className="field">
                <span>Assigned colleague</span>
                <select
                  value={filterOwner}
                  onChange={(e) => {
                    setFilterOwner(e.target.value);
                    setPage(0);
                  }}
                >
                  <option value="">All permitted colleagues</option>
                  {config.people.map((p) => (
                    <option value={p.id} key={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {["enquiries", "cases"].includes(resource.entity) && (
              <label className="field">
                <span>Service category</span>
                <select
                  value={filterService}
                  onChange={(e) => {
                    setFilterService(e.target.value);
                    setPage(0);
                  }}
                >
                  <option value="">All services</option>
                  {[
                    "procurement",
                    "hardware",
                    "consulting",
                    "support",
                    "ai",
                    "software",
                    "data",
                    "cloud",
                  ].map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </select>
              </label>
            )}
            <label className="field">
              <span>Recorded from</span>
              <input
                type="date"
                value={filterFrom}
                onChange={(e) => {
                  setFilterFrom(e.target.value);
                  setPage(0);
                }}
              />
            </label>
            <label className="field">
              <span>Recorded through</span>
              <input
                type="date"
                min={filterFrom || undefined}
                value={filterTo}
                onChange={(e) => {
                  setFilterTo(e.target.value);
                  setPage(0);
                }}
              />
            </label>
          </div>
          <button
            className="secondary"
            onClick={() => {
              setFilterOwner("");
              setFilterService("");
              setFilterFrom("");
              setFilterTo("");
              setPage(0);
            }}
          >
            Clear filters
          </button>
        </details>
        {busy ? (
          <p role="status">Loading records…</p>
        ) : rows.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Record</th>
                  <th>Status / detail</th>
                  <th>Amount / date</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id || String(r.document_id)}>
                    <td>
                      <strong>
                        {String(
                          r.number ||
                            r.reference ||
                            r.name ||
                            r.title ||
                            r.sku ||
                            r.document_id ||
                            r.serial ||
                            r.id,
                        )}
                      </strong>
                      <small>
                        {String(r.subject || r.description || r.email || "")}
                      </small>
                    </td>
                    <td>
                      <span className="badge">
                        {String(
                          r.status ||
                            r.outcome ||
                            r.stage ||
                            r.kind ||
                            r.location ||
                            "Recorded",
                        )}
                      </span>
                      {Boolean(r.assigned_to) && (
                        <small>
                          {config.people.find((p) => p.id === r.assigned_to)
                            ?.name || "Assigned"}
                        </small>
                      )}
                    </td>
                    <td>
                      {r.total_minor || r.amount_minor || r.value_minor
                        ? money(
                            Number(
                              r.total_minor || r.amount_minor || r.value_minor,
                            ),
                            String(r.currency || "NGN"),
                          )
                        : String(
                            r.follow_up ||
                              r.due_on ||
                              r.document_date ||
                              r.created_at ||
                              "",
                          ).slice(0, 10)}
                    </td>
                    <td>
                      <button
                        className="secondary"
                        onClick={() => setSelected(r)}
                      >
                        Open
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty">
            <h3>No records found</h3>
            <p>
              {query
                ? "Try another search."
                : "Use the action above to add a record, or choose another tool."}
            </p>
          </div>
        )}
        <div className="pagination">
          <button
            className="secondary"
            disabled={busy || page === 0}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </button>
          <span>Page {page + 1}</span>
          <button
            className="secondary"
            disabled={busy || !more}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </button>
        </div>
      </section>
      {resource.entity === "customers" && writable && (
        <CustomerImport onSaved={() => void load()} />
      )}
      {resource.entity === "stock" && <StockBalances />}
      {resource.entity === "bank_lines" && (
        <BankImport onSaved={() => void load()} />
      )}
    </>
  );
}
function Related({
  record,
  resource,
  config,
  act,
  onOpenDocument,
}: {
  record: Row;
  resource: Resource;
  config: BusinessConfig;
  act: (
    title: string,
    fields: FieldDef[],
    endpoint: string,
    fixed?: Record<string, unknown>,
    nested?: boolean,
  ) => void;
  onOpenDocument: (id?: string) => void;
}) {
  const [message, setMessage] = useState(""),
    [notes, setNotes] = useState<Row[]>([]),
    [related, setRelated] = useState<{ entity: string; rows: Row[] }[]>([]);
  useEffect(() => {
    if (!["customers", "cases", "enquiries"].includes(resource.entity)) return;
    api<{ entity: string; rows: Row[] }[]>(
      "business/related?entity=" + resource.entity + "&id=" + record.id,
    )
      .then(setRelated)
      .catch((e) => setMessage(e.message));
  }, [record.id, resource.entity]);
  useEffect(() => {
    if (resource.entity !== "customers") return;
    api<{ rows: Row[] }>("business/list", {
      entity: "notes",
      query: "",
      page: 0,
      parent: record.id,
      kind: "",
      status: "",
    })
      .then((r) => setNotes(r.rows))
      .catch(() => {});
  }, [record.id, resource.entity]);
  return (
    <div className="ops-gap">
      {resource.entity === "cases" && (
        <BusinessDelivery
          record={record}
          area={resource.area}
          approve={config.access[resource.area]?.approve || false}
        />
      )}
      <h3>Related work</h3>
      <button
        className="secondary"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(window.location.href);
            setMessage(
              "Internal record link copied. The recipient must sign in and have permission.",
            );
          } catch {
            setMessage(
              "Copy the current browser address to share this record with authorized staff.",
            );
          }
        }}
      >
        Copy internal link
      </button>
      {related.map((group) => (
        <details key={group.entity}>
          <summary>
            {group.entity.replaceAll("_", " ")} · {group.rows.length}
            {group.rows.length === 12 ? "+" : ""}
          </summary>
          <ul>
            {group.rows.map((r) => {
              const u = new URL(window.location.href);
              u.searchParams.set("section", "operations");
              u.searchParams.set("module", group.entity);
              if (r.kind) u.searchParams.set("kind", String(r.kind));
              else u.searchParams.delete("kind");
              u.searchParams.set("record", r.id || String(r.document_id));
              return (
                <li key={r.id || String(r.document_id)}>
                  <a href={u.pathname + u.search}>
                    {String(
                      r.number ||
                        r.reference ||
                        r.name ||
                        r.title ||
                        r.document_id ||
                        r.id,
                    )}{" "}
                    {r.status ? "· " + r.status : ""}
                  </a>
                </li>
              );
            })}
          </ul>
        </details>
      ))}
      {message && <p role="status">{message}</p>}
      <div className="actions">
        {["customers", "cases", "enquiries"].includes(resource.entity) && (
          <button
            className="secondary"
            onClick={() =>
              act(
                "Add internal note",
                [field("body", "Internal note", "textarea", true)],
                "misc",
                {
                  action: "note",
                  [resource.entity === "customers"
                    ? "customer_id"
                    : resource.entity === "cases"
                      ? "case_id"
                      : "enquiry_id"]: record.id,
                },
              )
            }
          >
            Add internal note
          </button>
        )}
        {resource.entity === "customers" && (
          <>
            <button
              className="secondary"
              onClick={async () => {
                try {
                  const r = await api<{ document_id: string }>(
                    "business/quote-draft",
                    { customer_id: record.id },
                  );
                  onOpenDocument(r.document_id);
                } catch (e) {
                  setMessage((e as Error).message);
                }
              }}
            >
              Prepare quotation
            </button>
            <button
              className="secondary"
              onClick={async () => {
                try {
                  await saveFile("business/statement", {
                    customer_id: record.id,
                    from: "",
                    to: "",
                    currency: "NGN",
                  });
                } catch (e) {
                  setMessage((e as Error).message);
                }
              }}
            >
              Download customer statement
            </button>
          </>
        )}
      </div>
      {resource.entity === "customers" && (
        <CustomerStatement id={record.id} email={String(record.email || "")} />
      )}
      {notes.length > 0 && (
        <ul>
          {notes.map((n) => (
            <li key={n.id}>
              {String(n.body)}{" "}
              <small>{String(n.created_at).slice(0, 10)}</small>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
function StockBalances() {
  const [rows, setRows] = useState<Row[]>([]),
    [error, setError] = useState("");
  useEffect(() => {
    api<Row[]>("business/stock-balances")
      .then(setRows)
      .catch((e) => setError(e.message));
  }, []);
  return (
    <section className="panel">
      <h3>Stock availability</h3>
      {error && <p role="alert">{error}</p>}
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Item</th>
              <th>Location / serial</th>
              <th>On hand</th>
              <th>Reserved</th>
              <th>Available</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td>{String(r.item_id)}</td>
                <td>
                  {String(r.location)}
                  <small>{String(r.serial)}</small>
                </td>
                <td>{Number(r.on_hand)}</td>
                <td>{Number(r.reserved)}</td>
                <td>{Number(r.on_hand) - Number(r.reserved)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
function BankImport({ onSaved }: { onSaved: () => void }) {
  const [text, setText] = useState(""),
    [preview, setPreview] = useState<unknown[]>([]),
    [message, setMessage] = useState("");
  return (
    <section className="panel">
      <h3>Import bank statement CSV</h3>
      <p>
        Use columns: date, amount, currency, reference. Positive amounts are
        money received. Importing does not create a payment.
      </p>
      <label className="field">
        <span>CSV contents</span>
        <textarea
          rows={6}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setPreview([]);
          }}
        />
      </label>
      <div className="actions">
        <button
          className="secondary"
          onClick={async () => {
            try {
              const r = await api<{ rows: unknown[] }>("business/bank-import", {
                csv: text,
                confirm: false,
              });
              setPreview(r.rows);
              setMessage(
                `${r.rows.length} rows validated. Review before importing.`,
              );
            } catch (e) {
              setMessage((e as Error).message);
            }
          }}
        >
          Validate and preview
        </button>
        <button
          disabled={!preview.length}
          onClick={async () => {
            try {
              const r = await api<{ inserted: number }>(
                "business/bank-import",
                { csv: text, confirm: true },
              );
              setMessage(`${r.inserted} new bank lines imported.`);
              setPreview([]);
              onSaved();
            } catch (e) {
              setMessage((e as Error).message);
            }
          }}
        >
          Import validated rows
        </button>
      </div>
      {message && <p role="status">{message}</p>}
      {preview.length > 0 && (
        <pre className="import-preview">{JSON.stringify(preview, null, 2)}</pre>
      )}
    </section>
  );
}
