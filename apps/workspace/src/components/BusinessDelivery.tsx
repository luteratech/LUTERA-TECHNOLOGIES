"use client";
import { useFeedback } from "@/lib/notifications";
import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import type { Row, Area } from "@/lib/business";
import {
  Fields,
  field,
  ref,
  initialValues,
  payloadValues,
  Reference,
  type FieldDef,
} from "./business-fields";
import { useUnsavedChanges } from "@/lib/unsaved";

const serviceFields: FieldDef[] = [
  ref("asset_id", "Related customer equipment", "assets"),
  field(
    "agreed_response_minutes",
    "Agreed first response in business minutes (leave blank if none)",
  ),
  field(
    "coverage",
    "Agreed coverage, contract term, visits and exclusions",
    "textarea",
  ),
  field("pause_reason", "Reason for waiting / paused work", "textarea"),
  field("resolution", "Resolution and handover notes", "textarea"),
  field("site_ready", "Site readiness confirmed", "checkbox"),
  field("equipment_checked", "Equipment and serials checked", "checkbox"),
  field("commissioning_complete", "Commissioning complete", "checkbox"),
  field("handover_complete", "Handover complete", "checkbox"),
  field("training_complete", "Agreed user training complete", "checkbox"),
];
export default function BusinessDelivery({
  record,
  area,
  approve,
}: {
  record: Row;
  area: Area;
  approve: boolean;
}) {
  const [service, setService] = useState<Row | null>(null),
    [changes, setChanges] = useState<Row[]>([]),
    [events, setEvents] = useState<Row[]>([]),
    [template, setTemplate] = useState(false),
    [values, setValues] = useState<Record<string, unknown>>(() =>
      initialValues(serviceFields),
    ),
    [message, setMessage] = useFeedback(),
    [busy, setBusy] = useState(false),
    [dirty, setDirty] = useState(false),
    [change, setChange] = useState<Record<string, unknown> | null>(null),
    [decision, setDecision] = useState<Row | null>(null),
    [reason, setReason] = useState(""),
    [replacement, setReplacement] = useState(""),
    [milestone, setMilestone] = useState("");
  useUnsavedChanges(dirty);
  const changeFields: FieldDef[] = [
    field("summary", "Change summary", "text", true),
    field(
      "details",
      "Requested scope, price and date changes",
      "textarea",
      true,
    ),
    field(
      "amount_minor",
      "Additional agreed amount (describe any reduction in the details)",
      "money",
      true,
    ),
    field("currency", "Currency", "select", true, ["NGN", "USD", "GBP", "EUR"]),
    field("revised_due_on", "Revised target date", "date"),
    {
      key: "evidence_id",
      label: "Customer change evidence",
      type: "evidence",
      area,
    },
  ];
  const load = async () => {
    const r = await api<{
      service: Row | null;
      changes: Row[];
      events: Row[];
      template: unknown;
    }>("business/delivery-work?id=" + record.id);
    setService(r.service);
    setValues(initialValues(serviceFields, r.service));
    setChanges(r.changes);
    setEvents(r.events);
    setTemplate(!!r.template);
  };
  useEffect(() => {
    load().catch((e) => setMessage(e));
  }, [record.id]);
  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setMessage("");
    try {
      await fn();
      await load();
      setDirty(false);
      setMessage(
        "Delivery controls saved. Refresh the main record before editing its status.",
      );
    } catch (e) {
      setMessage(e as Error);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="ops-gap">
      <h3>Delivery and service controls</h3>
      {message && null}
      <p>
        Response targets apply only when explicitly agreed. Targets use Lutera’s
        configured business calendar in Africa/Lagos. Waiting status keeps the
        agreed deadline unless it is explicitly revised.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void run(async () => {
            await api("business/delivery-work", {
              action: "service",
              case_id: record.id,
              version: service?.version || 0,
              data: payloadValues(serviceFields, values),
            });
          });
        }}
      >
        <Fields
          fields={serviceFields}
          values={values}
          disabled={busy}
          onChange={(k, v) => {
            setValues((x) => ({ ...x, [k]: v }));
            setDirty(true);
          }}
        />
        <button disabled={busy}>Save service controls</button>
      </form>
      {!template && (
        <button
          className="secondary ops-gap"
          disabled={busy || dirty}
          onClick={() =>
            void run(async () => {
              await api("business/delivery-work", {
                action: "template",
                case_id: record.id,
                request_key: crypto.randomUUID(),
              });
            })
          }
        >
          Add service delivery checklist
        </button>
      )}
      <h3>Scope and billing changes</h3>
      <p>
        Approved changes do not move money or alter issued documents. Link the
        separately reviewed order or billing milestone when applying the change.
      </p>
      <button
        className="secondary"
        disabled={busy || dirty}
        onClick={() => setChange(initialValues(changeFields))}
      >
        Request a change
      </button>
      {change && (
        <form
          className="ops-gap"
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              await api("business/delivery-work", {
                action: "change",
                case_id: record.id,
                request_key: crypto.randomUUID(),
                data: payloadValues(changeFields, change),
              });
              setChange(null);
            });
          }}
        >
          <Fields
            fields={changeFields}
            values={change}
            disabled={busy}
            onChange={(k, v) => setChange((x) => ({ ...x, [k]: v }))}
          />
          <button disabled={busy}>Submit change for approval</button>
          <button
            type="button"
            className="secondary"
            onClick={() => setChange(null)}
          >
            Cancel
          </button>
        </form>
      )}
      <ul>
        {changes.map((c) => (
          <li key={c.id}>
            <strong>{String(c.summary)}</strong> · {String(c.status)}
            <p>{String(c.details)}</p>
            {approve &&
              ["submitted", "approved"].includes(String(c.status)) && (
                <button
                  className="secondary"
                  onClick={() => {
                    setDecision(c);
                    setReason("");
                    setReplacement("");
                    setMilestone("");
                  }}
                >
                  Review change
                </button>
              )}
          </li>
        ))}
      </ul>
      {decision && (
        <form onSubmit={(e) => e.preventDefault()}>
          <label className="field">
            <span>Decision reason / owner exception</span>
            <textarea
              value={reason}
              minLength={5}
              maxLength={500}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          {decision.status === "approved" && (
            <>
              <div className="field">
                <span>Issued revised order</span>
                <Reference
                  entity="commercial"
                  kind="order"
                  label="Issued revised order"
                  value={replacement}
                  onChange={setReplacement}
                />
              </div>
              <div className="field">
                <span>Revised billing milestone</span>
                <Reference
                  entity="tasks"
                  label="Revised billing milestone"
                  value={milestone}
                  onChange={setMilestone}
                />
              </div>
            </>
          )}
          {(decision.status === "submitted"
            ? ["approved", "rejected"]
            : ["applied"]
          ).map((status) => (
            <button
              key={status}
              disabled={busy || reason.trim().length < 5}
              onClick={() =>
                void run(async () => {
                  await api("business/delivery-work", {
                    action: "decide",
                    case_id: record.id,
                    id: decision.id,
                    version: decision.version,
                    decision: status,
                    reason,
                    replacement_order_id: replacement,
                    task_id: milestone,
                  });
                  setDecision(null);
                })
              }
            >
              {status === "approved"
                ? "Approve with reason"
                : status === "rejected"
                  ? "Reject"
                  : "Apply linked change"}
            </button>
          ))}
        </form>
      )}
      <details className="ops-gap">
        <summary>Status and reopening history</summary>
        <ul>
          {events.map((e) => (
            <li key={e.id}>
              {String(e.previous_status || "Created")} → {String(e.status)}
              {e.note ? " · " + String(e.note) : ""} ·{" "}
              {new Date(String(e.created_at)).toLocaleString("en-NG", {
                timeZone: "Africa/Lagos",
              })}
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}
