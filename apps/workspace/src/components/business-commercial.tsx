"use client";
import { useFeedback } from "@/lib/notifications";
import { useEffect, useState } from "react";
import { api, saveFile } from "@/lib/client";
import { minor, money } from "@/lib/contracts";
import {
  businessDate,
  commercialArea,
  commercialKinds,
  type Row,
  type Access,
  type CommercialKind,
} from "@/lib/business";
import { useUnsavedChanges, mayLeave } from "@/lib/unsaved";
import {
  Fields,
  field,
  ref,
  Reference,
  type FieldDef,
} from "./business-fields";
const heads: FieldDef[] = [
  field("kind", "Document type", "select", true, [...commercialKinds]),
  field("title", "Title / project reference", "text", true),
  field("document_date", "Document date", "date", true),
  field("due_date", "Due / target date", "date"),
  field("currency", "Currency", "select", true, ["NGN", "USD", "GBP", "EUR"]),
  field("discount", "Discount amount", "money"),
  field("tax", "Tax percentage", "number"),
  field("notes", "Agreed payment terms / notes", "textarea"),
];
type Line = {
  id?: string;
  item_id: string;
  source_line_id: string;
  task_id?: string;
  description: string;
  quantity: string;
  price: string;
};
const blank = (): Line => ({
  item_id: "",
  source_line_id: "",
  description: "",
  quantity: "1",
  price: "0.00",
});
export default function CommercialEditor({
  record,
  kind = "order",
  access,
  onBack,
  onSaved,
  initialSource,
  onConvert,
}: {
  record: Row | null;
  kind?: CommercialKind;
  access: Access;
  onBack: () => void;
  onSaved: (r: Row) => void;
  initialSource?: string;
  onConvert?: (kind: CommercialKind, id: string) => void;
}) {
  const [row, setRow] = useState<Row | null>(record),
    [data, setData] = useState<Record<string, unknown>>({
      kind: record?.kind || kind,
      title: record?.title || "",
      document_date: record?.document_date || businessDate(),
      due_date: record?.due_date || "",
      currency: record?.currency || "NGN",
      discount: (Number(record?.discount_minor || 0) / 100).toFixed(2),
      tax: Number(record?.tax_bps || 0) / 100,
      notes: record?.notes || "",
      customer_id: record?.customer_id || "",
      supplier_id: record?.supplier_id || "",
      source_id: record?.source_id || "",
      quote_id: record?.quote_id || "",
    }),
    [lines, setLines] = useState<Line[]>([blank()]),
    [sourceLines, setSourceLines] = useState<Row[]>([]),
    [key, setKey] = useState(() => crypto.randomUUID()),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useFeedback(),
    [dirty, setDirty] = useState(false),
    [reason, setReason] = useState("");
  const area = commercialArea(String(data.kind)),
    locked = Boolean(row && row.status !== "draft"),
    write = access[area]?.write;
  useUnsavedChanges(dirty);
  useEffect(() => {
    if (!record) return;
    let active = true;
    api<{ lines: Row[] }>("business/detail?entity=commercial&id=" + record.id)
      .then((r) => {
        if (active)
          setLines(
            r.lines.map((l) => ({
              id: l.id,
              item_id: String(l.item_id || ""),
              source_line_id: String(l.source_line_id || ""),
              task_id: String(l.task_id || ""),
              description: String(l.description),
              quantity: String(l.quantity),
              price: (Number(l.unit_minor) / 100).toFixed(2),
            })),
          );
      })
      .catch((e) => {
        if (active) setMessage(e);
      });
    return () => {
      active = false;
    };
  }, [record]);
  const update = (k: string, v: unknown) => {
    setData((d) => ({ ...d, [k]: v }));
    setDirty(true);
  };
  const total = () => {
    try {
      const sub = lines.reduce(
        (s, l) => s + Number(l.quantity) * minor(l.price || "0"),
        0,
      );
      const discounted = sub - minor(String(data.discount || "0"));
      return (
        discounted + Math.round((discounted * Number(data.tax || 0)) / 100)
      );
    } catch {
      return 0;
    }
  };
  async function source(id: string) {
    update("source_id", id);
    setSourceLines([]);
    if (!id) return;
    setBusy(true);
    setMessage("");
    try {
      const result = await api<{ record: Row; lines: Row[] }>(
        "business/detail?entity=commercial&id=" +
          id +
          (data.kind === "delivery" ? "&fulfilment=1" : ""),
      );
      setSourceLines(result.lines);
      setData((d) => ({
        ...d,
        source_id: id,
        customer_id: result.record.customer_id || "",
        supplier_id: result.record.supplier_id || "",
        currency: result.record.currency,
        discount: (Number(result.record.discount_minor) / 100).toFixed(2),
        tax: Number(result.record.tax_bps) / 100,
      }));
      setLines(
        result.lines.map((l) => ({
          source_line_id: l.id,
          item_id: String(l.item_id || ""),
          description: String(l.description),
          quantity: String(l.quantity),
          price: (Number(l.unit_minor) / 100).toFixed(2),
        })),
      );
      setDirty(true);
    } catch (e) {
      setMessage(e as Error);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (initialSource && !record) void source(initialSource);
  }, [initialSource]);
  async function save() {
    const payload = {
      kind: data.kind,
      customer_id: data.customer_id || "",
      supplier_id: data.supplier_id || "",
      source_id: data.source_id || "",
      quote_id: data.quote_id || "",
      title: data.title,
      document_date: data.document_date,
      due_date: data.due_date || "",
      currency: data.currency,
      discount_minor: minor(String(data.discount || "0")),
      tax_bps: Math.round(Number(data.tax || 0) * 100),
      notes: data.notes,
      lines: lines.map((l) => ({
        item_id: l.item_id,
        source_line_id: l.source_line_id,
        task_id: l.task_id || "",
        description: l.description,
        quantity: Number(l.quantity),
        unit_minor: minor(l.price),
      })),
    };
    const r = await api<Row>("business/commercial-save", {
      ...(row ? { id: row.id } : {}),
      version: row?.version || 0,
      request_key: key,
      data: payload,
    });
    setRow(r);
    setKey(crypto.randomUUID());
    setDirty(false);
    onSaved(r);
    setMessage("Draft saved. Review the details before issuing.");
  }
  async function issue(action: "issue" | "cancel") {
    setBusy(true);
    setMessage("");
    try {
      if (!row) throw new Error("Save the draft first.");
      if (dirty) throw new Error("Save your changes before issuing.");
      const result = await api<Row>("business/commercial-issue", {
        id: row.id,
        version: row.version,
        action,
        reason,
      });
      setRow(result);
      onSaved(result);
      setMessage(
        action === "issue"
          ? "Document issued and locked."
          : "Document cancelled.",
      );
    } catch (e) {
      setMessage(e as Error);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel">
      <div className="toolbar">
        <div>
          <p className="eyebrow">
            {row?.number ? String(row.number) : "Unnumbered draft"}
          </p>
          <h2>
            {String(data.kind).replaceAll("_", " ")} ·{" "}
            {String(row?.status || "draft")}
          </h2>
        </div>
        <button
          className="secondary"
          onClick={async () => {
            if (await mayLeave()) onBack();
          }}
        >
          Back to list
        </button>
      </div>
      {message && null}
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setMessage("");
          try {
            await save();
          } catch (err) {
            setMessage(err as Error);
          } finally {
            setBusy(false);
          }
        }}
      >
        <Fields
          fields={heads.filter((f) => f.key !== "kind" || !record)}
          values={data}
          onChange={update}
          disabled={busy || locked || !write}
        />
        <fieldset
          disabled={busy || locked || !write}
          className="business-fields"
        >
          <div className="form-grid">
            {["purchase", "rfq"].includes(String(data.kind)) ? (
              <label className="field">
                <span>Supplier *</span>
                <Reference
                  entity="suppliers"
                  label="Supplier"
                  required
                  value={String(data.supplier_id || "")}
                  onChange={(v) => update("supplier_id", v)}
                />
              </label>
            ) : (
              <label className="field">
                <span>Customer *</span>
                <Reference
                  entity="customers"
                  label="Customer"
                  required
                  value={String(data.customer_id || "")}
                  onChange={(v) => update("customer_id", v)}
                />
              </label>
            )}
            {["invoice", "credit", "delivery"].includes(String(data.kind)) && (
              <label className="field">
                <span>
                  {data.kind === "credit"
                    ? "Source invoice"
                    : "Source sales order"}{" "}
                  *
                </span>
                <Reference
                  entity="commercial"
                  kind={data.kind === "credit" ? "invoice" : "order"}
                  fulfilment={data.kind === "delivery"}
                  required
                  value={String(data.source_id || "")}
                  onChange={(v) => void source(v)}
                />
                <small>
                  Loading a source copies its lines. Reduce quantities for
                  staged billing or partial delivery.
                </small>
              </label>
            )}
          </div>
          {data.kind === "order" && (
            <label className="field">
              <span>
                Accepted quotation (optional; unlinked orders need owner
                approval)
              </span>
              <Reference
                entity="quotes"
                kind="accepted"
                label="Accepted quotation"
                value={String(data.quote_id || "")}
                onChange={async (id) => {
                  update("quote_id", id);
                  if (!id) return;
                  try {
                    const q = await api<{
                      payload: {
                        customer: { name: string };
                        currency: string;
                        items: {
                          description: string;
                          quantity: number;
                          unit_minor: number;
                        }[];
                        discount_minor: number;
                        tax_bps: number;
                      };
                    }>("business/legacy-document?id=" + id);
                    setData((d) => ({
                      ...d,
                      currency: q.payload.currency,
                      discount: (q.payload.discount_minor / 100).toFixed(2),
                      tax: q.payload.tax_bps / 100,
                    }));
                    setLines(
                      q.payload.items.map((l) => ({
                        item_id: "",
                        source_line_id: "",
                        description: l.description,
                        quantity: String(l.quantity),
                        price: (l.unit_minor / 100).toFixed(2),
                      })),
                    );
                  } catch (e) {
                    setMessage(e as Error);
                  }
                }}
              />
            </label>
          )}
          <h3>Line items</h3>
          {lines.map((l, index) => (
            <div className="ops-line" key={l.id || index}>
              <div className="field">
                <span>Catalogue item (optional)</span>
                <Reference
                  entity="items"
                  label={"Catalogue item " + (index + 1)}
                  value={l.item_id}
                  onChange={async (id) => {
                    try {
                      const result = id
                        ? await api<{ record: Row }>(
                            "business/detail?entity=items&id=" + id,
                          )
                        : null;
                      const item = result?.record;
                      setLines((ls) =>
                        ls.map((x, i) =>
                          i === index
                            ? {
                                ...x,
                                item_id: id,
                                ...(item
                                  ? {
                                      description: String(item.name),
                                      price: (
                                        Number(item.unit_minor) / 100
                                      ).toFixed(2),
                                    }
                                  : {}),
                              }
                            : x,
                        ),
                      );
                      setDirty(true);
                    } catch (e) {
                      setMessage(e as Error);
                    }
                  }}
                />
              </div>
              {data.kind === "invoice" && (
                <div className="field">
                  <span>Completed billable milestone (optional)</span>
                  <Reference
                    entity="tasks"
                    label={"Billable milestone " + (index + 1)}
                    value={l.task_id || ""}
                    onChange={(v) => {
                      setLines((ls) =>
                        ls.map((x, i) =>
                          i === index ? { ...x, task_id: v } : x,
                        ),
                      );
                      setDirty(true);
                    }}
                  />
                  <small>
                    The milestone must be completed, billable, linked to this
                    order and not invoiced previously.
                  </small>
                </div>
              )}
              <label className="field">
                <span>Description *</span>
                <input
                  required
                  maxLength={400}
                  value={l.description}
                  onChange={(e) => {
                    setLines((ls) =>
                      ls.map((x, i) =>
                        i === index ? { ...x, description: e.target.value } : x,
                      ),
                    );
                    setDirty(true);
                  }}
                />
              </label>
              <label className="field">
                <span>Quantity *</span>
                <input
                  required
                  type="number"
                  min={1}
                  max={1000000}
                  value={l.quantity}
                  onChange={(e) => {
                    setLines((ls) =>
                      ls.map((x, i) =>
                        i === index ? { ...x, quantity: e.target.value } : x,
                      ),
                    );
                    setDirty(true);
                  }}
                />
              </label>
              <label className="field">
                <span>Unit price *</span>
                <input
                  required
                  inputMode="decimal"
                  value={l.price}
                  onChange={(e) => {
                    setLines((ls) =>
                      ls.map((x, i) =>
                        i === index ? { ...x, price: e.target.value } : x,
                      ),
                    );
                    setDirty(true);
                  }}
                />
              </label>
              {lines.length > 1 && (
                <button
                  type="button"
                  className="secondary"
                  onClick={() => {
                    setLines((ls) => ls.filter((_, i) => i !== index));
                    setDirty(true);
                  }}
                >
                  Remove line {index + 1}
                </button>
              )}
            </div>
          ))}
          {!["invoice", "credit", "delivery"].includes(String(data.kind)) && (
            <button
              type="button"
              className="secondary"
              disabled={lines.length >= 40}
              onClick={() => {
                setLines((ls) => [...ls, blank()]);
                setDirty(true);
              }}
            >
              Add line +
            </button>
          )}
        </fieldset>
        <p className="ops-total">
          Calculated total{" "}
          <strong>{money(total(), String(data.currency))}</strong>
        </p>
        {!locked && write && <button disabled={busy}>Save draft</button>}
      </form>
      {row?.status === "issued" && onConvert && (
        <div className="actions ops-gap">
          {(row.kind === "order"
            ? (["invoice", "delivery"] as const)
            : row.kind === "invoice"
              ? (["credit"] as const)
              : row.kind === "rfq"
                ? (["purchase"] as const)
                : []
          )
            .filter((k) => access[commercialArea(k)]?.write)
            .map((k) => (
              <button
                className="secondary"
                key={k}
                onClick={() => onConvert(k, row.id)}
              >
                Create{" "}
                {k === "credit"
                  ? "credit note"
                  : k === "purchase"
                    ? "purchase order"
                    : k}{" "}
                from this document ↗
              </button>
            ))}
        </div>
      )}
      {row && (
        <>
          <div className="actions ops-gap">
            {(["pdf", "docx", "png"] as const).map((f) => (
              <button
                className="secondary"
                key={f}
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await saveFile("business/export", {
                      id: row.id,
                      format: f,
                    });
                  } catch (e) {
                    setMessage(e as Error);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Export {f.toUpperCase()}
              </button>
            ))}
          </div>
          {write && row.status === "draft" && (
            <div className="ops-gap">
              <label className="field">
                <span>Issue / approval reason *</span>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  minLength={5}
                  maxLength={500}
                />
              </label>
              <p>
                Issuing freezes prices, customer details and terms. The owner’s
                own approval is recorded as an owner decision.
              </p>
              <button
                disabled={busy || dirty || reason.trim().length < 5}
                onClick={() => void issue("issue")}
              >
                Issue numbered document
              </button>
            </div>
          )}
          {row.status === "issued" &&
            !["invoice", "credit"].includes(String(data.kind)) &&
            access[area]?.approve && (
              <details className="ops-gap">
                <summary>Cancel this document</summary>
                <label className="field">
                  <span>Cancellation reason *</span>
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                </label>
                <button
                  className="danger secondary"
                  disabled={busy || reason.trim().length < 5}
                  onClick={() => void issue("cancel")}
                >
                  Confirm cancellation
                </button>
              </details>
            )}
        </>
      )}
    </section>
  );
}
