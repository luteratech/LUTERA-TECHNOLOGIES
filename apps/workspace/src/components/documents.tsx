"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  documentSchema,
  minor,
  money,
  totals,
  type BusinessDocument,
  type DocumentInput,
  type Settings,
} from "@/lib/contracts";
import { api, Field, Notice, saveFile } from "./Workspace";
import { mayLeave, useUnsavedChanges } from "@/lib/unsaved";
import { workspaceLocation } from "@/lib/workspace-navigation";
import { useRecords, Pagination } from "./records";
import { Evidence } from "./business-fields";
const today = () => new Date().toISOString().slice(0, 10);
const inputOf = (record: BusinessDocument) => {
  const input = { ...record.payload };
  delete input.company;
  delete input.void_reason;
  return input;
};
const empty = (
  kind: DocumentInput["kind"],
  currency: Settings["currency"],
): DocumentInput => ({
  kind,
  customer: { name: "", address: "", email: "", phone: "" },
  date: today(),
  valid_until: "",
  currency,
  items: [{ description: "", quantity: 1, unit_minor: 100 }],
  discount_minor: 0,
  tax_bps: 0,
  notes: "",
  payment_method: "",
  payment_reference: "",
  payment_confirmed: false,
  source_id: "",
});
export default function Documents({
  records,
  settings,
  refresh,
  initialId,
  focusKind,
}: {
  initialId?: string;
  focusKind?: DocumentInput["kind"];
  records: BusinessDocument[];
  settings: Settings;
  refresh: () => Promise<void>;
}) {
  const [selected, setSelected] = useState<BusinessDocument | null | undefined>(
      undefined,
    ),
    [kind, setKind] = useState<DocumentInput["kind"]>(focusKind || "quotation"),
    [search, setSearch] = useState(""),
    [filter, setFilter] = useState("all"),
    [searchBy, setSearchBy] = useState<"name" | "number">("name");
  const [restored, setRestored] = useState(false);
  const locationReady = useRef(false),
    previous = useRef<string | undefined>(undefined);
  useEffect(() => {
    let active = true;
    const params = new URLSearchParams(location.search),
      id = initialId || params.get("document");
    if (id && id !== "new") {
      api<BusinessDocument>(
        "business/legacy-document?id=" + encodeURIComponent(id),
      )
        .then((r) => {
          if (active) setSelected(r);
        })
        .catch(() => {})
        .finally(() => {
          if (active) setRestored(true);
        });
    } else {
      if (id === "new") {
        const type = params.get("documentKind");
        if (type === "quotation" || type === "proforma" || type === "receipt")
          setKind(type);
        setSelected(null);
      }
      setRestored(true);
    }
    return () => {
      active = false;
    };
  }, [initialId]);
  useEffect(() => {
    if (!restored) return;
    const id = selected === null ? "new" : selected?.id;
    workspaceLocation(
      {
        document: id || null,
        documentKind: focusKind || (selected === null ? kind : null),
      },
      !locationReady.current || (previous.current === "new" && !!selected),
    );
    previous.current = id;
    locationReady.current = true;
  }, [selected, kind, restored, focusKind]);
  const initialRecords = useMemo(
    () => (focusKind ? records.filter((r) => r.kind === focusKind) : records),
    [records, focusKind],
  );
  const listing = useRecords({
    area: "finance",
    initial: initialRecords,
    kind: focusKind,
    query: search,
    field: search.toUpperCase().startsWith("LUT-") ? "number" : searchBy,
    status: filter,
    enabled: selected === undefined,
  });
  useEffect(() => {
    if (selected) {
      const updated = records.find((d) => d.id === selected.id);
      if (updated && updated.version !== selected.version) setSelected(updated);
    }
  }, [records, selected]);
  if (selected !== undefined)
    return (
      <Editor
        key={selected?.id || `new-${kind}`}
        record={selected}
        settings={settings}
        kind={kind}
        records={records}
        onBack={() => {
          if (mayLeave()) setSelected(undefined);
        }}
        onSaved={async (d) => {
          setSelected(d);
          await refresh();
        }}
        onDeleted={async () => {
          setSelected(undefined);
          await refresh();
        }}
      />
    );
  const shown = listing.rows;
  return (
    <>
      <section className="panel toolbar">
        <div>
          <h2>
            {focusKind
              ? {
                  quotation: "Quotation documents",
                  proforma: "Pro forma invoices",
                  receipt: "Receipt documents",
                }[focusKind]
              : "Quotations, pro formas & receipts"}
          </h2>
          <p>
            {focusKind === "receipt"
              ? "Find original receipts here. Record new money received through Finance → Payments & receipts."
              : "Prepare the draft, review the details, then issue and export the document."}
          </p>
        </div>
        <div className="actions">
          {!focusKind && (
            <>
              <label className="sr-only" htmlFor="new-kind">
                New document type
              </label>
              <select
                id="new-kind"
                value={kind}
                onChange={(e) =>
                  setKind(e.target.value as DocumentInput["kind"])
                }
              >
                <option value="quotation">Quotation</option>
                <option value="proforma">Pro forma invoice</option>
                <option value="receipt">Payment receipt</option>
              </select>
            </>
          )}
          {focusKind !== "receipt" && (
            <button onClick={() => setSelected(null)}>
              {focusKind === "quotation"
                ? "Prepare a quotation"
                : focusKind === "proforma"
                  ? "Prepare a pro forma"
                  : "New document +"}
            </button>
          )}
        </div>
      </section>
      <section className="panel">
        <div className="form-grid">
          <Field label="Search all documents">
            <input
              type="search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                listing.setPage(0);
              }}
              placeholder="Customer or document number"
            />
          </Field>
          <Field label="Search by">
            <select
              value={searchBy}
              onChange={(e) => {
                setSearchBy(e.target.value as typeof searchBy);
                listing.setPage(0);
              }}
            >
              <option value="name">Customer name</option>
              <option value="number">Document number</option>
            </select>
          </Field>
          <Field label="Status">
            <select
              value={filter}
              onChange={(e) => {
                setFilter(e.target.value);
                listing.setPage(0);
              }}
            >
              {["all", "draft", "issued", "void"].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </Field>
        </div>
        {shown.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Document</th>
                  <th>Customer</th>
                  <th>Total</th>
                  <th>Status</th>
                  <th>
                    <span className="sr-only">Action</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {shown.map((doc) => (
                  <tr key={doc.id}>
                    <td>
                      <strong>{doc.number || "Unnumbered draft"}</strong>
                      <small>
                        {doc.kind} · {doc.payload.date}
                      </small>
                    </td>
                    <td>{doc.payload.customer.name}</td>
                    <td>{money(doc.total_minor, doc.payload.currency)}</td>
                    <td>
                      <span className={`badge ${doc.status}`}>
                        {doc.status}
                      </span>
                    </td>
                    <td>
                      <button
                        className="secondary"
                        onClick={() => setSelected(doc)}
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
            <h3>No matching documents</h3>
            <p>Create a draft or change your search.</p>
          </div>
        )}
        <Pagination {...listing} onPage={listing.setPage} />
      </section>
    </>
  );
}
export function Editor({
  record,
  settings,
  kind,
  records,
  onBack,
  onSaved,
  onDeleted,
  business = false,
}: {
  business?: boolean;
  record: BusinessDocument | null;
  settings: Settings;
  kind: DocumentInput["kind"];
  records: BusinessDocument[];
  onBack: () => void;
  onSaved: (d: BusinessDocument) => Promise<void>;
  onDeleted: () => Promise<void>;
}) {
  const [doc, setDoc] = useState<DocumentInput>(
    record ? inputOf(record) : empty(kind, settings.currency),
  );
  const [items, setItems] = useState(
    (record?.payload.items || doc.items).map((i) => ({
      description: i.description,
      quantity: String(i.quantity),
      price: (i.unit_minor / 100).toFixed(2),
    })),
  );
  const [discount, setDiscount] = useState(
      ((record?.payload.discount_minor || 0) / 100).toFixed(2),
    ),
    [tax, setTax] = useState(String((record?.payload.tax_bps || 0) / 100));
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [confirm, setConfirm] = useState<"issue" | "void" | "delete" | null>(null),
    [dirty, setDirty] = useState(false);
  const [linkedSearch, setLinkedSearch] = useState(""),
    [linkedMatches, setLinkedMatches] = useState<BusinessDocument[]>([]);
  const sourceRecords = [
    ...new Map(
      [...records, ...linkedMatches].map((item) => [item.id, item]),
    ).values(),
  ];
  useEffect(() => {
    if (doc.kind !== "receipt" || linkedSearch.length < 3) return;
    let alive = true;
    const timer = setTimeout(() => {
      api<{ rows: BusinessDocument[] }>("records", {
        area: "finance",
        query: linkedSearch,
        field: "number",
        status: "issued",
        page: 0,
      })
        .then((result) => {
          if (alive) setLinkedMatches(result.rows);
        })
        .catch((error) => {
          if (alive) setMessage(error.message);
        });
    }, 250);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [doc.kind, linkedSearch]);
  const locked = Boolean(record && record.status !== "draft");
  useEffect(() => {
    if (record) {
      setDoc(inputOf(record));
      setItems(
        record.payload.items.map((i) => ({
          description: i.description,
          quantity: String(i.quantity),
          price: (i.unit_minor / 100).toFixed(2),
        })),
      );
      setDiscount((record.payload.discount_minor / 100).toFixed(2));
      setTax(String(record.payload.tax_bps / 100));
      setDirty(false);
    }
  }, [record]);
  useUnsavedChanges(dirty);
  function update<K extends keyof DocumentInput>(
    key: K,
    value: DocumentInput[K],
  ) {
    setDoc({ ...doc, [key]: value });
    setDirty(true);
  }
  function payload() {
    return documentSchema.parse({
      ...doc,
      items: items.map((i) => ({
        description: i.description,
        quantity: Number(i.quantity),
        unit_minor: minor(i.price),
      })),
      discount_minor: minor(discount),
      tax_bps: minor(tax),
    });
  }
  let sum: {
    subtotal: number;
    discount: number;
    tax: number;
    total: number;
  } | null = null;
  try {
    sum = totals(payload());
  } catch {}
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const next = await api<BusinessDocument>(
        business ? "business/quote-save" : "documents/save",
        {
          ...(record ? { id: record.id, version: record.version } : {}),
          payload: payload(),
        },
      );
      setDirty(false);
      await onSaved(next);
      setMessage("Draft saved. Review it before issuing.");
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function change(action: "issue" | "void" | "delete", reason?: string) {
    if (!record) return;
    setBusy(true);
    setMessage("");
    try {
      const next = await api<BusinessDocument>(
        business ? "business/quote-status" : "documents/status",
        {
          id: record.id,
          version: record.version,
          action,
          ...(reason ? { reason } : {}),
        },
      );
      setConfirm(null);
      if (action === "delete") await onDeleted();
      else await onSaved(next);
      setMessage(
        action === "issue"
          ? "Document issued and locked."
          : "Document voided; the original record is retained.",
      );
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function exportFile(format: "pdf" | "docx" | "png") {
    if (!record) return;
    setBusy(true);
    setMessage("");
    try {
      await saveFile(business ? "business/quote-export" : "export", {
        entity: "document",
        id: record.id,
        format,
      });
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <button
        className="text-button back"
        onClick={() => {
          if (!dirty || window.confirm("Discard unsaved changes?")) onBack();
        }}
      >
        ← All documents
      </button>
      <div className="editor-heading">
        <div>
          <p className="eyebrow">
            {doc.kind === "proforma" ? "Pro forma invoice" : doc.kind}
          </p>
          <h2>{record?.number || (record ? "Saved draft" : "New draft")}</h2>
        </div>
        {record && (
          <span className={`badge ${record.status}`}>{record.status}</span>
        )}
      </div>
      <form className="panel" onSubmit={save}>
        <fieldset disabled={locked || busy}>
          <legend>Customer & document details</legend>
          <div className="form-grid">
            {(["name", "email", "phone", "address"] as const).map((key) => (
              <Field
                key={key}
                label={`Customer ${key}${key === "name" ? " *" : ""}`}
              >
                <input
                  value={doc.customer[key]}
                  type={key === "email" ? "email" : "text"}
                  required={key === "name"}
                  maxLength={key === "address" ? 600 : 160}
                  onChange={(e) =>
                    update("customer", {
                      ...doc.customer,
                      [key]: e.target.value,
                    })
                  }
                />
              </Field>
            ))}
            <Field label="Document date *">
              <input
                type="date"
                required
                value={doc.date}
                onChange={(e) => update("date", e.target.value)}
              />
            </Field>
            <Field label="Valid until (optional)">
              <input
                type="date"
                min={doc.date}
                value={doc.valid_until}
                onChange={(e) => update("valid_until", e.target.value)}
              />
            </Field>
            <Field label="Currency">
              <select
                value={doc.currency}
                onChange={(e) =>
                  update(
                    "currency",
                    e.target.value as DocumentInput["currency"],
                  )
                }
              >
                {["NGN", "USD", "GBP", "EUR"].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </Field>
          </div>
          {doc.kind === "receipt" && (
            <div className="receipt-fields">
              <h3>Payment received</h3>
              <p>
                Enter the amount actually received as a line item. A receipt may
                be linked to an issued quotation or pro forma.
              </p>
              <div className="form-grid">
                <Field label="Find a linked document by number">
                  <input
                    value={linkedSearch}
                    maxLength={100}
                    placeholder="LUT-QUO-2026-000001"
                    onChange={(e) => setLinkedSearch(e.target.value)}
                  />
                </Field>
                <Field label="Linked document (optional)">
                  <select
                    value={doc.source_id}
                    onChange={(e) => {
                      const source = sourceRecords.find(
                        (r) => r.id === e.target.value,
                      );
                      setDoc({
                        ...doc,
                        source_id: e.target.value,
                        ...(source
                          ? {
                              customer: source.payload.customer,
                              currency: source.payload.currency,
                            }
                          : {}),
                      });
                      setDirty(true);
                    }}
                  >
                    <option value="">No linked document</option>
                    {sourceRecords
                      .filter(
                        (r) => r.kind !== "receipt" && r.status === "issued",
                      )
                      .map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.number} · {r.payload.customer.name}
                        </option>
                      ))}
                  </select>
                </Field>
                <Field label="Payment method *">
                  <input
                    required
                    value={doc.payment_method}
                    maxLength={100}
                    onChange={(e) => update("payment_method", e.target.value)}
                    placeholder="Bank transfer, cash…"
                  />
                </Field>
                <Field label="Payment reference (optional)">
                  <input
                    value={doc.payment_reference}
                    maxLength={160}
                    onChange={(e) =>
                      update("payment_reference", e.target.value)
                    }
                  />
                </Field>
              </div>
              <label className="field">
                <span>Payment evidence *</span>
                <Evidence
                  value={doc.evidence_id || ""}
                  onChange={(v) => update("evidence_id", v)}
                  area="finance"
                  required={!locked}
                />
              </label>
              <label className="check">
                <input
                  type="checkbox"
                  checked={doc.payment_confirmed}
                  onChange={(e) =>
                    update("payment_confirmed", e.target.checked)
                  }
                />
                I have verified that Lutera received this payment.
              </label>
            </div>
          )}
          <h3>Line items</h3>
          <div className="line-items">
            {items.map((item, index) => (
              <div className="line-item" key={index}>
                <Field label={`Item ${index + 1} description *`}>
                  <input
                    value={item.description}
                    required
                    maxLength={400}
                    onChange={(e) => {
                      setItems(
                        items.map((row, i) =>
                          i === index
                            ? { ...row, description: e.target.value }
                            : row,
                        ),
                      );
                      setDirty(true);
                    }}
                  />
                </Field>
                <Field label="Quantity *">
                  <input
                    type="number"
                    min="1"
                    max="1000000"
                    step="1"
                    required
                    value={item.quantity}
                    onChange={(e) => {
                      setItems(
                        items.map((row, i) =>
                          i === index
                            ? { ...row, quantity: e.target.value }
                            : row,
                        ),
                      );
                      setDirty(true);
                    }}
                  />
                </Field>
                <Field label="Unit price *">
                  <input
                    inputMode="decimal"
                    required
                    value={item.price}
                    onChange={(e) => {
                      setItems(
                        items.map((row, i) =>
                          i === index ? { ...row, price: e.target.value } : row,
                        ),
                      );
                      setDirty(true);
                    }}
                  />
                </Field>
                <button
                  type="button"
                  className="remove"
                  aria-label={`Remove item ${index + 1}`}
                  disabled={items.length === 1}
                  onClick={() => {
                    setItems(items.filter((_, i) => i !== index));
                    setDirty(true);
                  }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            className="secondary"
            disabled={items.length >= 40}
            onClick={() => {
              setItems([
                ...items,
                { description: "", quantity: "1", price: "0.00" },
              ]);
              setDirty(true);
            }}
          >
            Add line item +
          </button>
          {doc.kind !== "receipt" && (
            <div className="form-grid adjustments">
              <Field label="Discount amount">
                <input
                  inputMode="decimal"
                  value={discount}
                  onChange={(e) => {
                    setDiscount(e.target.value);
                    setDirty(true);
                  }}
                />
              </Field>
              <Field label="Tax rate (%) — confirm before use">
                <input
                  inputMode="decimal"
                  value={tax}
                  onChange={(e) => {
                    setTax(e.target.value);
                    setDirty(true);
                  }}
                />
              </Field>
            </div>
          )}
          <Field label="Notes / agreed terms">
            <textarea
              rows={4}
              maxLength={2000}
              value={doc.notes}
              onChange={(e) => update("notes", e.target.value)}
            />
          </Field>
        </fieldset>
        <div className="totals">
          <span>
            {sum
              ? `Subtotal ${money(sum.subtotal, doc.currency)} · Discount ${money(sum.discount, doc.currency)} · Tax ${money(sum.tax, doc.currency)}`
              : "Complete the required details to calculate the total."}
          </span>
          <strong>{sum ? money(sum.total, doc.currency) : "—"}</strong>
        </div>
        <div className="actions">
          {!locked && (
            <button disabled={busy}>{busy ? "Saving…" : "Save draft"}</button>
          )}
          {record?.status === "draft" && (
            <button
              type="button"
              className="secondary"
              disabled={busy || dirty}
              onClick={() => setConfirm("issue")}
            >
              Review & issue
            </button>
          )}
          {record?.status === "draft" && !business && (
            <button
              type="button"
              className="danger secondary"
              disabled={busy}
              onClick={() => setConfirm("delete")}
            >
              Delete draft
            </button>
          )}
          {record?.status === "issued" && (
            <button
              type="button"
              className="danger secondary"
              disabled={busy}
              onClick={() => setConfirm("void")}
            >
              Void document
            </button>
          )}
        </div>
        {dirty && (
          <p className="muted">
            Unsaved changes. Save before issuing or exporting.
          </p>
        )}
        {message && <Notice>{message}</Notice>}
      </form>
      {record && (
        <section className="panel">
          <h3>Export document</h3>
          <p>
            Issued documents use the company details captured when they were
            issued. Draft exports are marked as drafts.
          </p>
          <div className="actions">
            {(["pdf", "docx", "png"] as const).map((f) => (
              <button
                key={f}
                className="secondary"
                disabled={busy || dirty}
                onClick={() => exportFile(f)}
              >
                {f === "docx" ? "Word (.docx)" : f.toUpperCase()} ↓
              </button>
            ))}
          </div>
          {record.payload.void_reason && (
            <Notice>Void reason: {record.payload.void_reason}</Notice>
          )}
        </section>
      )}
      {confirm && (
        <ConfirmDialog
          title={
            confirm === "issue"
              ? "Issue and lock this document?"
              : confirm === "void"
                ? "Void this document?"
                : "Delete this draft?"
          }
          onCancel={() => setConfirm(null)}
          busy={busy}
          reason={confirm === "void"}
          onConfirm={(reason) => change(confirm, reason)}
        >
          <p>
            {confirm === "issue"
              ? `Check the customer, line items, tax and ${money(record!.total_minor, doc.currency)} total. Issuing assigns a permanent number; further corrections require voiding this record and creating a replacement.`
              : confirm === "void"
                ? "The original document and its number will remain in the records. Explain why it is being cancelled."
                : "This unissued draft will be removed. The deletion remains in the activity history."}
          </p>
          {message && (
            <p className="error" role="alert">
              {message}
            </p>
          )}
        </ConfirmDialog>
      )}
    </>
  );
}
export function ConfirmDialog({
  title,
  children,
  onCancel,
  onConfirm,
  busy,
  reason = false,
}: {
  title: string;
  children: React.ReactNode;
  onCancel: () => void;
  onConfirm: (reason?: string) => void;
  busy: boolean;
  reason?: boolean;
}) {
  const [node, setNode] = useState<HTMLDialogElement | null>(null);
  useEffect(() => {
    node?.showModal();
    return () => node?.close();
  }, [node]);
  return (
    <dialog
      ref={setNode}
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onCancel();
      }}
      aria-labelledby="confirm-title"
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const form = new FormData(e.currentTarget);
          onConfirm(reason ? String(form.get("reason")) : undefined);
        }}
      >
        <h2 id="confirm-title">{title}</h2>
        {children}
        {reason && (
          <Field label="Reason *">
            <textarea
              name="reason"
              minLength={5}
              maxLength={500}
              rows={3}
              required
              autoFocus
            />
          </Field>
        )}
        <div className="actions">
          <button disabled={busy}>{busy ? "Working…" : "Confirm"}</button>
          <button
            type="button"
            className="secondary"
            disabled={busy}
            onClick={onCancel}
          >
            Cancel
          </button>
        </div>
      </form>
    </dialog>
  );
}
