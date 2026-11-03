"use client";
import { useFeedback } from "@/lib/notifications";
import { useEffect, useState } from "react";
import {
  staffSchema,
  type Staff,
  type StaffInput,
  type Settings,
} from "@/lib/contracts";
import { api, Field, Notice, saveFile } from "./Workspace";
import { ConfirmDialog } from "./documents";
import { mayLeave, useUnsavedChanges } from "@/lib/unsaved";
import { useRecords, Pagination } from "./records";
export default function StaffCards({
  records,
  settings,
  refresh,
}: {
  records: Staff[];
  settings: Settings;
  refresh: () => Promise<void>;
}) {
  const [selected, setSelected] = useState<Staff | null | undefined>(undefined),
    [search, setSearch] = useState(""),
    [field, setField] = useState<"name" | "number" | "title">("name");
  const listing = useRecords({
    area: "staff",
    initial: records,
    query: search,
    field,
    enabled: selected === undefined,
  });
  if (selected !== undefined)
    return (
      <Editor
        key={selected?.id || "new"}
        record={selected}
        settings={settings}
        onBack={() => setSelected(undefined)}
        onSaved={async (next) => {
          setSelected(next);
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
          <h2>The people behind the work.</h2>
          <p>
            Manage staff profiles and create branded name cards or company ID
            cards.
          </p>
        </div>
        <button onClick={() => setSelected(null)}>Add staff profile +</button>
      </section>
      <section className="panel">
        <Field label="Search all staff profiles">
          <input
            type="search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              listing.setPage(0);
            }}
            placeholder="Enter your search"
          />
        </Field>
        <Field label="Search by">
          <select
            value={field}
            onChange={(e) => {
              setField(e.target.value as typeof field);
              listing.setPage(0);
            }}
          >
            <option value="name">Name</option>
            <option value="number">Staff number</option>
            <option value="title">Job title</option>
          </select>
        </Field>
        {shown.length ? (
          shown.map((staff) => (
            <div className="record-row" key={staff.id}>
              <div>
                <strong>{staff.payload.name}</strong>
                <small>
                  {staff.payload.title} · {staff.payload.staff_number} ·{" "}
                  {staff.payload.active ? "Active" : "Inactive"}
                </small>
              </div>
              <button className="secondary" onClick={() => setSelected(staff)}>
                Open
              </button>
            </div>
          ))
        ) : (
          <div className="empty">
            <h3>No matching staff profiles</h3>
            <p>Add a profile to create a card.</p>
          </div>
        )}
        <Pagination {...listing} onPage={listing.setPage} />
      </section>
    </>
  );
}
function Editor({
  record,
  settings,
  onBack,
  onSaved,
  onDeleted,
}: {
  record: Staff | null;
  settings: Settings;
  onBack: () => void;
  onSaved: (r: Staff) => Promise<void>;
  onDeleted: () => Promise<void>;
}) {
  const [value, setValue] = useState<StaffInput>(
    record?.payload || {
      name: "",
      title: "",
      staff_number: "",
      department: "",
      email: "",
      phone: "",
      issued_on: new Date().toISOString().slice(0, 10),
      expires_on: "",
      active: true,
      photo_path: "",
    },
  );
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useFeedback(),
    [dirty, setDirty] = useState(false),
    [template, setTemplate] = useState<"name" | "id">("name"),
    [side, setSide] = useState<"front" | "back">("front"),
    [confirm, setConfirm] = useState(false),
    [bleed, setBleed] = useState(false);
  useEffect(() => {
    if (record) {
      setValue(record.payload);
      setDirty(false);
    }
  }, [record]);
  useUnsavedChanges(dirty);
  function update<K extends keyof StaffInput>(key: K, next: StaffInput[K]) {
    setValue({ ...value, [key]: next });
    setDirty(true);
  }
  async function photo(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setMessage("");
    try {
      if (file.size > 1048576)
        throw new Error("Choose a photograph under 1 MB");
      const bytes = new Uint8Array(await file.arrayBuffer());
      let binary = "";
      for (const byte of bytes) binary += String.fromCharCode(byte);
      const response = await api<{ path: string }>("staff/photo", {
        data: btoa(binary),
      });
      update("photo_path", response.path);
    } catch (e) {
      setMessage(e as Error);
    } finally {
      setBusy(false);
    }
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const payload = staffSchema.parse(value);
      const next = await api<Staff>("staff/save", {
        ...(record ? { id: record.id, version: record.version } : {}),
        payload,
      });
      await onSaved(next);
      setMessage("Staff profile saved.");
    } catch (e) {
      setMessage(e as Error);
    } finally {
      setBusy(false);
    }
  }
  async function exportFile(format: "pdf" | "docx" | "png") {
    if (!record) return;
    setBusy(true);
    setMessage("");
    try {
      await saveFile("export", {
        entity: "staff",
        id: record.id,
        format,
        template,
        side,
        bleed: format === "pdf" && bleed,
      });
    } catch (e) {
      setMessage(e as Error);
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    if (!record) return;
    setBusy(true);
    setMessage("");
    try {
      await api("staff/delete", { id: record.id, version: record.version });
      setConfirm(false);
      await onDeleted();
    } catch (e) {
      setMessage(e as Error);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <button
        className="text-button back"
        onClick={async () => {
          if (await mayLeave()) onBack();
        }}
      >
        ← All staff profiles
      </button>
      <div className="editor-heading">
        <h2>{record ? value.name : "New staff profile"}</h2>
      </div>
      <div className="staff-editor">
        <form className="panel" onSubmit={save}>
          <fieldset disabled={busy}>
            <legend>Staff details</legend>
            <div className="form-grid">
              {(
                [
                  "name",
                  "title",
                  "staff_number",
                  "department",
                  "email",
                  "phone",
                ] as const
              ).map((key) => (
                <Field
                  key={key}
                  label={
                    {
                      name: "Full name",
                      title: "Job title",
                      staff_number: "Staff number",
                      department: "Department",
                      email: "Email",
                      phone: "Phone number",
                    }[key] +
                    (["name", "title", "staff_number"].includes(key)
                      ? " *"
                      : "")
                  }
                >
                  <input
                    type={key === "email" ? "email" : "text"}
                    value={value[key]}
                    required={["name", "title", "staff_number"].includes(key)}
                    maxLength={key === "email" ? 254 : 140}
                    onChange={(e) => update(key, e.target.value)}
                  />
                </Field>
              ))}
              <Field label="Issued on *">
                <input
                  type="date"
                  required
                  value={value.issued_on}
                  onChange={(e) => update("issued_on", e.target.value)}
                />
              </Field>
              <Field label="Expires on (optional)">
                <input
                  type="date"
                  min={value.issued_on}
                  value={value.expires_on}
                  onChange={(e) => update("expires_on", e.target.value)}
                />
              </Field>
            </div>
            <label className="check">
              <input
                type="checkbox"
                checked={value.active}
                onChange={(e) => update("active", e.target.checked)}
              />
              Active staff member
            </label>
            <Field label="Staff photograph (JPEG, PNG or WebP, under 1 MB)">
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => photo(e.target.files?.[0])}
              />
            </Field>
            {value.photo_path && (
              <button
                type="button"
                className="text-button"
                onClick={() => update("photo_path", "")}
              >
                Remove photograph
              </button>
            )}
          </fieldset>
          <div className="actions">
            <button disabled={busy}>
              {busy ? "Saving…" : "Save staff profile"}
            </button>
            {record && (
              <button
                type="button"
                className="secondary danger"
                onClick={() => setConfirm(true)}
                disabled={busy}
              >
                Delete profile
              </button>
            )}
          </div>
        </form>
        <section className="panel card-tools">
          <h3>Card preview</h3>
          <div className="form-grid">
            <Field label="Template">
              <select
                value={template}
                onChange={(e) => setTemplate(e.target.value as "name" | "id")}
              >
                <option value="name">Name card · 85 × 55 mm</option>
                <option value="id">ID card · 54 × 86 mm</option>
              </select>
            </Field>
            <Field label="Side">
              <select
                value={side}
                onChange={(e) => setSide(e.target.value as "front" | "back")}
              >
                <option value="front">Front</option>
                <option value="back">Back</option>
              </select>
            </Field>
          </div>
          <div
            className={`card-preview ${template} ${side}`}
            aria-label={`${template === "name" ? "Business card" : "Staff ID"} ${side} preview`}
          >
            {(template === "id" || side === "front") && (
              <>
                <span className="card-graphic" aria-hidden="true" />
                <img
                  className="card-logo"
                  src={`/brand/lutera-horizontal-${template === "name" ? "descriptor-" : ""}dark.svg`}
                  alt="Lutera"
                />
              </>
            )}
            {template === "name" ? (
              side === "front" ? (
                <>
                  <p className="card-tagline">Supply. Build. Connect.</p>
                  <p className="card-legal">{settings.company.name}</p>
                </>
              ) : (
                <>
                  <h3 className="card-person">{value.name || "Staff name"}</h3>
                  <p className="card-job">{value.title || "Job title"}</p>
                  <div className="card-contact">
                    <span>{value.email || settings.company.email}</span>
                    <span>{value.phone || settings.company.phone}</span>
                    <span>{settings.company.website}</span>
                  </div>
                  {/Abuja/i.test(settings.company.address) && (
                    <p className="card-location">Abuja, Nigeria</p>
                  )}
                </>
              )
            ) : side === "front" ? (
              <>
                <div className="portrait">
                  {value.photo_path ? (
                    <img
                      src={`/api/photo/${value.photo_path}`}
                      alt="Staff portrait"
                    />
                  ) : (
                    <span>Photograph</span>
                  )}
                </div>
                <h3 className="card-person">{value.name || "Staff name"}</h3>
                <p className="card-job">{value.title || "Job title"}</p>
                <p className="card-department">{value.department}</p>
                <p className="card-staff-id document-reference">
                  {value.staff_number || "Staff number"}
                </p>
                <div className="card-dates">
                  <span>Issued {value.issued_on}</span>
                  {value.expires_on && <span>Expires {value.expires_on}</span>}
                </div>
              </>
            ) : (
              <>
                <h3 className="card-back-heading">Company identification</h3>
                <h3 className="card-company">{settings.company.name}</h3>
                <p className="card-address">{settings.company.address}</p>
                <div className="card-contact">
                  <span>{settings.company.email}</span>
                  <span>{settings.company.phone}</span>
                  <span>{settings.company.website}</span>
                </div>
                <p className="card-return">
                  Property of Lutera. If found, contact the company. This is not
                  a government-issued identity document.
                </p>
              </>
            )}
            {(!value.active ||
              (value.expires_on &&
                value.expires_on <
                  new Date().toLocaleDateString("en-CA", {
                    timeZone: "Africa/Lagos",
                  }))) && (
              <strong className="invalid-card">
                {!value.active ? "Inactive" : "Expired"}
              </strong>
            )}
          </div>
          <label className="check">
            <input
              type="checkbox"
              checked={bleed}
              onChange={(e) => setBleed(e.target.checked)}
            />
            Include 3 mm print bleed and crop marks in PDF
          </label>
          <p className="muted">
            Preview shows the card layout. PDF includes both sides at print
            size, with optional bleed for a printer. PNG exports the selected
            side. Word exports contain both card images.
          </p>
          <div className="actions">
            {(["pdf", "docx", "png"] as const).map((f) => (
              <button
                key={f}
                className="secondary"
                disabled={!record || busy || dirty}
                onClick={() => exportFile(f)}
              >
                {f === "docx" ? "Word (.docx)" : f.toUpperCase()} ↓
              </button>
            ))}
          </div>
          {(!record || dirty) && (
            <p className="muted">Save this profile before exporting.</p>
          )}
        </section>
      </div>
      {confirm && (
        <ConfirmDialog
          title="Delete this staff profile?"
          busy={busy}
          onCancel={() => setConfirm(false)}
          onConfirm={remove}
        >
          <p>
            The profile will be removed. Its deletion remains in the activity
            history.
          </p>
        </ConfirmDialog>
      )}
    </>
  );
}
