"use client";
import { useFeedback, confirmAction, requestReason } from "@/lib/notifications";
import {
  useCallback,
  useEffect,
  useState,
  useId,
  useRef,
  cloneElement,
  isValidElement,
  type ReactNode,
  type ReactElement,
} from "react";
import { api, saveFile } from "@/lib/client";
import { useCooldown } from "@/lib/cooldown";
import { money, minor } from "@/lib/contracts";
import { mayLeave, useUnsavedChanges } from "@/lib/unsaved";
import {
  emptyOwnerSetup,
  ownerSetupSchema,
  accountingPeriod,
  journalTotals,
  reportSummary,
  type SuiteConfig,
  type OwnerSetup,
  type LedgerAccount,
  type LedgerJournal,
  type LedgerReport,
  type DocumentSignature,
} from "@/lib/suite";
const today = () =>
  new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Lagos" });
function Field({ label, children }: { label: string; children: ReactNode }) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>
        <span>{label}</span>
      </label>
      {isValidElement(children)
        ? cloneElement(children as ReactElement<Record<string, unknown>>, {
            id,
          })
        : children}
    </div>
  );
}
export default function OwnerSuite({
  view,
}: {
  view: "setup" | "accounting" | "signature" | "approvals";
}) {
  const [config, setConfig] = useState<SuiteConfig | null>(null),
    [error, setError] = useFeedback("error");
  const load = useCallback(async () => {
    try {
      setConfig(await api<SuiteConfig>("suite/config"));
      setError("");
    } catch (e) {
      setError(e as Error);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  if (!config)
    return (
      <section className="panel">
        <p role={error ? "alert" : "status"}>
          {error || "Opening your business tools…"}
        </p>
        <button className="secondary" onClick={load}>
          Retry
        </button>
      </section>
    );
  return (
    <>
      {error && null}
      {view === "setup" ? (
        <OwnerSettings config={config} refresh={load} />
      ) : view === "accounting" ? (
        <Accounting config={config} refresh={load} />
      ) : view === "signature" ? (
        <SignatureProfile config={config} refresh={load} />
      ) : (
        <Approvals config={config} />
      )}
    </>
  );
}
function OwnerSettings({
  config,
  refresh,
}: {
  config: SuiteConfig;
  refresh: () => Promise<void>;
}) {
  const [value, setValue] = useState<OwnerSetup>(() =>
      ownerSetupSchema.parse(config.setup?.payload || emptyOwnerSetup),
    ),
    [dirty, setDirty] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useFeedback(),
    [error, setError] = useFeedback("error");
  useUnsavedChanges(dirty);
  if (!config.owner)
    return (
      <p>
        Only the company owner can configure company tax and accounting records.
      </p>
    );
  const update = (next: OwnerSetup) => {
    setValue(next);
    setDirty(true);
  };
  const period = accountingPeriod(
    value.accounting.cutover,
    value.accounting.cutover,
    value.accounting.year_end,
  );
  const displayDate = (date: string) =>
    new Date(date + "T00:00:00Z").toLocaleDateString("en-NG", {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    });
  const tax = (k: keyof OwnerSetup["tax"], v: string) =>
    update({ ...value, tax: { ...value.tax, [k]: v } });
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        try {
          await api("suite/setup", {
            version: config.setup!.version,
            data: value,
          });
          setDirty(false);
          setMessage(
            "Owner settings saved. Pending tax details can be completed later.",
          );
          await refresh();
        } catch (e) {
          setError(e as Error);
        } finally {
          setBusy(false);
        }
      }}
    >
      <section className="panel">
        <h2>Company tax setup</h2>
        <p className="notice">
          Tax profile:{" "}
          {value.tax.status === "pending" ? "Setup pending" : "Owner-confirmed"}
          . A pending profile does not mean the company is tax-exempt. Leave
          unavailable details blank and return when ready.
        </p>
        <fieldset disabled={busy}>
          <legend className="sr-only">Tax profile</legend>
          <div className="form-grid">
            <Field label="Company Tax ID">
              <input
                value={value.tax.tax_id}
                maxLength={80}
                onChange={(e) => tax("tax_id", e.target.value)}
              />
            </Field>
            <Field label="Company registration number">
              <input
                value={value.tax.registration_number}
                maxLength={80}
                onChange={(e) => tax("registration_number", e.target.value)}
              />
            </Field>
            <Field label="VAT registration or exemption status">
              <select
                value={value.tax.vat_status}
                onChange={(e) => tax("vat_status", e.target.value)}
              >
                <option value="unconfirmed">Not confirmed yet</option>
                <option value="registered">Registered for VAT</option>
                <option value="exempt">Exemption confirmed</option>
                <option value="not_registered">
                  Not registered — status reviewed
                </option>
              </select>
            </Field>
            <Field label="Tax profile effective date">
              <input
                type="date"
                value={value.tax.effective_from}
                onChange={(e) => tax("effective_from", e.target.value)}
              />
            </Field>
            <Field label="Supporting authority or professional reference">
              <input
                value={value.tax.reference}
                maxLength={1000}
                onChange={(e) => tax("reference", e.target.value)}
              />
            </Field>
            <Field label="Profile review status">
              <select
                value={value.tax.status}
                onChange={(e) => tax("status", e.target.value)}
              >
                <option value="pending">Pending — complete later</option>
                <option value="confirmed">I have verified this profile</option>
              </select>
            </Field>
            <Field label="Tax notes and outstanding records">
              <textarea
                rows={3}
                maxLength={3000}
                value={value.tax.notes}
                onChange={(e) => tax("notes", e.target.value)}
              />
            </Field>
          </div>
        </fieldset>
        <p>
          Calculations and filing obligations depend on the applicable law,
          effective dates and the company’s verified circumstances. This screen
          records setup; it does not submit a tax return or register the company
          with NRS.
        </p>
      </section>
      <section className="panel">
        <h2>Accounting start and opening balances</h2>
        <p>
          Choose a start date after reviewing existing bank, customer, supplier,
          deposit and stock balances. Earlier history must be reconciled once
          through opening entries; importing a record must not duplicate its
          opening balance.
        </p>
        <div className="form-grid">
          <Field label="Accounting start date">
            <input
              type="date"
              value={value.accounting.cutover}
              disabled={busy || !!config.setup?.payload.accounting.enabled}
              onChange={(e) =>
                update({
                  ...value,
                  accounting: { ...value.accounting, cutover: e.target.value },
                })
              }
            />
          </Field>
          <Field label="Financial year-end (MM-DD)">
            <input
              value={value.accounting.year_end}
              required
              pattern="[0-9]{2}-[0-9]{2}"
              maxLength={5}
              placeholder="12-31"
              disabled={busy}
              onChange={(e) =>
                update({
                  ...value,
                  accounting: { ...value.accounting, year_end: e.target.value },
                })
              }
            />
          </Field>
          <Field label="Opening balances reviewed">
            <input
              type="checkbox"
              checked={value.accounting.opening_reviewed}
              disabled={busy}
              onChange={(e) =>
                update({
                  ...value,
                  accounting: {
                    ...value.accounting,
                    opening_reviewed: e.target.checked,
                  },
                })
              }
            />
          </Field>
          <Field label="Enable ledger posting">
            <input
              type="checkbox"
              checked={value.accounting.enabled}
              disabled={busy}
              onChange={(e) =>
                update({
                  ...value,
                  accounting: {
                    ...value.accounting,
                    enabled: e.target.checked,
                  },
                })
              }
            />
          </Field>
          <Field label="Allow explicit owner self-approval">
            <input
              type="checkbox"
              checked={value.solo_owner}
              disabled={busy}
              onChange={(e) =>
                update({ ...value, solo_owner: e.target.checked })
              }
            />
          </Field>
        </div>
        {period && (
          <p className="notice">
            First accounting period: {displayDate(period.from)} to{" "}
            {displayDate(period.through)}. Later financial years follow this
            annual year-end. Closing a period remains a reviewed action.
          </p>
        )}
        {value.accounting.opening_position && (
          <div className="notice">
            <strong>Confirmed opening position</strong>
            <p>
              As of {displayDate(value.accounting.cutover)}:{" "}
              <span className="numeric">{money(0, "NGN")}</span>; no unpaid
              customer invoices, supplier bills, deposits, loans, stock or fixed
              assets. Later transactions are recorded with their actual dates.
            </p>
          </div>
        )}
        <h3>Payment terms and approval responsibilities</h3>
        <p>
          Enter payment terms separately on each transaction, based on the
          agreement with the client. Due dates have no fixed default. Existing
          document numbering sequences remain in use.
        </p>
        <p>
          The owner handles approvals initially. Assign colleagues their roles,
          department approval permissions and signing authority under User
          access and Business permissions as they join.
        </p>
        <p>
          Owner self-approval is recorded as such. It does not claim an
          independent reviewer participated. Colleague signing and ledger
          authority are assigned separately under User access and Business
          permissions.
        </p>
      </section>
      {error && null}
      {message && null}
      <button disabled={busy}>
        {busy ? "Saving…" : "Save owner settings"}
      </button>
    </form>
  );
}
function SignatureProfile({
  config,
  refresh,
}: {
  config: SuiteConfig;
  refresh: () => Promise<void>;
}) {
  const [name, setName] = useState(config.profile?.full_name || ""),
    [capacity, setCapacity] = useState(config.profile?.capacity || ""),
    [image, setImage] = useState(config.profile?.image_data || ""),
    [dirty, setDirty] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useFeedback(),
    [error, setError] = useFeedback("error");
  useUnsavedChanges(dirty);
  return (
    <section className="panel">
      <h2>Your personal signing profile</h2>
      <p>
        Upload a clear PNG or JPEG of your signature. It is applied only when
        you explicitly sign an authorised document after authenticator
        verification. Each approved version keeps its own signing snapshot.
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            await api("suite/signature-profile", {
              full_name: name,
              capacity,
              image_data: image,
            });
            setDirty(false);
            setMessage("Your signature profile has been saved.");
            await refresh();
          } catch (e) {
            setError(e as Error);
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="form-grid">
          <Field label="Signatory full name">
            <input
              required
              maxLength={160}
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setDirty(true);
              }}
            />
          </Field>
          <Field label="Signing capacity or job title">
            <input
              required
              maxLength={120}
              value={capacity}
              onChange={(e) => {
                setCapacity(e.target.value);
                setDirty(true);
              }}
            />
          </Field>
          <Field label="Upload your signature (PNG/JPEG, under 200 KB)">
            <input
              type="file"
              accept="image/png,image/jpeg"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                if (file.size > 200000) {
                  setError("Choose an image under 200 KB.");
                  return;
                }
                const reader = new FileReader();
                reader.onload = () => {
                  setImage(String(reader.result));
                  setDirty(true);
                };
                reader.readAsDataURL(file);
              }}
            />
          </Field>
        </div>
        {image && (
          <img
            className="signature-preview"
            src={image}
            alt="Your signature preview"
          />
        )}
        <p>
          These are authenticated electronic approvals. Certificate-based PDF
          signing requires a separate signing certificate/provider; a signature
          image does not create that certificate.
        </p>
        {error && null}
        {message && null}
        <button disabled={busy || !image}>
          {busy ? "Saving…" : "Save personal signature"}
        </button>
      </form>
    </section>
  );
}
function Approvals({ config }: { config: SuiteConfig }) {
  const cooldown = useCooldown();
  const requestSerial = useRef(0);
  const [preview, setPreview] = useState<Record<string, unknown> | null>(null);
  const [table, setTable] = useState("work_commercial"),
    [rows, setRows] = useState<Record<string, unknown>[]>([]),
    [selected, setSelected] = useState(""),
    [signatures, setSignatures] = useState<DocumentSignature[]>([]),
    [code, setCode] = useState(""),
    [factor, setFactor] = useState(config.factors[0]?.id || ""),
    [reason, setReason] = useState(""),
    [consent, setConsent] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useFeedback("error"),
    [message, setMessage] = useFeedback();
  useEffect(() => {
    ++requestSerial.current;
    setSelected("");
    setSignatures([]);
    api<{ rows: Record<string, unknown>[] }>(`suite/documents?table=${table}`)
      .then((r) => setRows(r.rows))
      .catch((e) => setError(e));
  }, [table]);
  const row = rows.find((r) => r.id === selected);
  const load = async (id: string) => {
    const serial = ++requestSerial.current;
    setSelected(id);
    setPreview(null);
    if (!id) {
      setSignatures([]);
      return;
    }
    setMessage("");
    try {
      const [record, approvals] = await Promise.all([
        api<Record<string, unknown>>(
          `suite/document-preview?table=${table}&id=${id}`,
        ),
        api<DocumentSignature[]>(`suite/signatures?table=${table}&id=${id}`),
      ]);
      if (serial !== requestSerial.current) return;
      setPreview(record);
      setSignatures(approvals);
      setError("");
    } catch (e) {
      setError(e as Error);
    }
  };
  return (
    <section className="panel">
      <h2>Document approvals and signatures</h2>
      <p>
        Select an issued or approved document. Review its original details
        before signing; drafts cannot be signed. Your signature confirms company
        authorisation and does not replace payment evidence or customer
        acceptance.
      </p>
      <div className="form-grid">
        <Field label="Approved document type">
          <select value={table} onChange={(e) => setTable(e.target.value)}>
            <option value="work_commercial">
              Invoices, orders and other commercial documents
            </option>
            <option value="work_documents">
              Quotations, pro formas and payment receipts
            </option>
            <option value="work_expenses">Approved bills and expenses</option>
          </select>
        </Field>
        <Field label="Select an issued or approved document">
          <select value={selected} onChange={(e) => void load(e.target.value)}>
            <option value="">Choose a document…</option>
            {rows.map((r) => (
              <option key={String(r.id)} value={String(r.id)}>
                {String(r.number || r.title || "Approved document")} ·{" "}
                {String(r.kind || "expense")} ·{" "}
                {String(r.document_date || r.created_at || "").slice(0, 10)}
              </option>
            ))}
          </select>
        </Field>
      </div>
      {row && (
        <>
          <div className="notice">
            <strong>{String(row.number || row.title)}</strong>
            <p>
              {String(row.kind || "Expense")} · {String(row.status)} · Version{" "}
              {String(row.version)} ·{" "}
              {money(
                Number(row.total_minor || row.amount_minor || 0),
                String(
                  row.currency ||
                    (row.payload as { currency?: string })?.currency ||
                    "NGN",
                ),
              )}
            </p>
            <p>
              Open this document in its original workspace to review all lines,
              terms and evidence.
            </p>
          </div>
          {preview && (
            <div className="panel">
              <h3>Review the exact document</h3>
              <p>
                {String(
                  (preview.snapshot as { party?: { name?: string } })?.party
                    ?.name ||
                    (preview.payload as { customer?: { name?: string } })
                      ?.customer?.name ||
                    preview.title ||
                    "",
                )}
              </p>
              <div className="table-scroll" tabIndex={0}>
                <table>
                  <thead>
                    <tr>
                      <th>Description</th>
                      <th>Quantity</th>
                      <th>Unit amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(
                      (preview.lines ||
                        (preview.payload as { items?: unknown[] })?.items ||
                        []) as {
                        description: string;
                        quantity: number;
                        unit_minor: number;
                      }[]
                    ).map((l, i) => (
                      <tr key={i}>
                        <td>{l.description}</td>
                        <td className="numeric">{l.quantity}</td>
                        <td className="numeric">
                          {money(
                            l.unit_minor,
                            String(
                              preview.currency ||
                                (preview.payload as { currency?: string })
                                  ?.currency ||
                                "NGN",
                            ),
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p>
                {String(
                  preview.notes ||
                    (preview.payload as { notes?: string })?.notes ||
                    "",
                )}
              </p>
            </div>
          )}
          <p>
            {signatures.length
              ? `${signatures.length} authenticated approval(s) on this exact version.`
              : "This version has no recorded signature yet."}
          </p>
          {signatures.map((s) => (
            <div className="signature-record" key={s.id}>
              <img src={s.image_data} alt={`Signature of ${s.full_name}`} />
              <strong>{s.full_name}</strong>
              <p>
                {s.capacity} ·{" "}
                {new Date(s.created_at).toLocaleString("en-NG", {
                  timeZone: "Africa/Lagos",
                })}
              </p>
              <p>
                {s.approval_reason} ·{" "}
                {s.self_approved
                  ? "Owner self-approval"
                  : "Authorised approval"}
              </p>
              <small>
                Approval reference: {s.id}
                <br />
                Document fingerprint: {s.source_hash}
              </small>
            </div>
          ))}
          {table !== "work_expenses" && (
            <div className="actions">
              {(["pdf", "docx", "png"] as const).map((format) => (
                <button
                  className="secondary"
                  key={format}
                  onClick={async () => {
                    setError("");
                    try {
                      await saveFile(
                        table === "work_commercial"
                          ? "business/export"
                          : "export",
                        table === "work_commercial"
                          ? { id: selected, format }
                          : {
                              entity: "document",
                              id: selected,
                              format,
                              template: "name",
                              side: "front",
                            },
                      );
                    } catch (e) {
                      setError(e as Error);
                    }
                  }}
                >
                  Export {format.toUpperCase()}
                </button>
              ))}
            </div>
          )}
          {config.sign && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!row || !consent) return;
                setBusy(true);
                setError("");
                try {
                  await api("suite/sign", {
                    source_table: table,
                    source_id: selected,
                    source_version: Number(row.version),
                    expected_hash: String(preview?._approval_hash || ""),
                    reason,
                    factorId: factor,
                    code,
                  });
                  setCode("");
                  setConsent(false);
                  await load(selected);
                  setMessage(
                    "Your signature is recorded on this document version.",
                  );
                } catch (e) {
                  setCode("");
                  cooldown.handle(e);
                  setError(e as Error);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <h3>Sign this version</h3>
              <p>
                Your approval reason stays in the private audit record. Customer
                copies show the signatory and approval reference.
              </p>
              <div className="form-grid">
                <Field label="Approval reason">
                  <input
                    required
                    minLength={5}
                    maxLength={500}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                </Field>
                <Field label="Authenticator">
                  <select
                    required
                    value={factor}
                    onChange={(e) => setFactor(e.target.value)}
                  >
                    {config.factors.map((f) => (
                      <option value={f.id} key={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Fresh six-digit authenticator code">
                  <input
                    required
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                  />
                </Field>
              </div>
              <Field label="I reviewed this exact document and authorise applying my signature">
                <input
                  type="checkbox"
                  required
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                />
              </Field>
              <button
                disabled={
                  busy ||
                  !config.profile ||
                  !preview ||
                  preview.id !== selected ||
                  preview.version !== row.version ||
                  cooldown.seconds > 0
                }
              >
                {busy
                  ? "Signing…"
                  : cooldown.seconds
                    ? `Try again in ${cooldown.seconds}s`
                    : "Approve and apply my signature"}
              </button>
              {!config.profile && (
                <p>Save your personal signature profile first.</p>
              )}
            </form>
          )}
        </>
      )}
      {!rows.length && (
        <p>
          No issued documents are available in this category. Prepare and issue
          a document through its normal workflow first.
        </p>
      )}
      {error && null}
      {message && null}
    </section>
  );
}
function Accounting({
  config,
  refresh,
}: {
  config: SuiteConfig;
  refresh: () => Promise<void>;
}) {
  const [accounts, setAccounts] = useState<LedgerAccount[]>([]),
    [journals, setJournals] = useState<LedgerJournal[]>([]),
    [page, setPage] = useState(0),
    [more, setMore] = useState(false),
    [editing, setEditing] = useState<LedgerJournal | null | undefined>(),
    [tab, setTab] = useState("journals"),
    [error, setError] = useFeedback("error"),
    [message, setMessage] = useFeedback();
  const load = useCallback(async () => {
    if (!config.read) return;
    try {
      const [a, j] = await Promise.all([
        api<LedgerAccount[]>("suite/accounts"),
        api<{ rows: LedgerJournal[]; more: boolean }>(
          "suite/journals?page=" + page,
        ),
      ]);
      setAccounts(a);
      setJournals(j.rows);
      setMore(j.more);
      setError("");
    } catch (e) {
      setError(e as Error);
    }
  }, [page, config.read]);
  useEffect(() => {
    void load();
  }, [load]);
  if (!config.read)
    return (
      <p>
        Your account has no company accounting access. The owner can assign the
        required finance permissions.
      </p>
    );
  const done = async () => {
    setEditing(undefined);
    setMessage("Accounting record saved.");
    await load();
    await refresh();
  };
  if (editing !== undefined)
    return (
      <JournalEditor
        accounts={accounts}
        record={editing}
        onBack={async () => {
          if (await mayLeave()) setEditing(undefined);
        }}
        onSaved={done}
      />
    );
  return (
    <>
      <div className="panel">
        <h2>Company accounting</h2>
        <p className={config.accounting_enabled ? "notice" : "error"}>
          {config.accounting_enabled
            ? "Ledger posting is enabled."
            : "Ledger posting is not enabled. The owner can complete the accounting start and opening-balance review in Owner settings."}
        </p>
        <p>
          Tax profile: {config.tax_status}. Reports show posted journals only,
          separately by currency. Unposted business activity and opening
          balances must be reconciled before treating them as complete accounts.
        </p>
        <div className="actions">
          {["journals", "accounts", "sources", "reports", "periods"].map(
            (t) => (
              <button
                key={t}
                className={tab === t ? "" : "secondary"}
                onClick={async () => {
                  if (await mayLeave()) setTab(t);
                }}
              >
                {
                  (
                    {
                      journals: "Journals",
                      accounts: "Chart of accounts",
                      sources: "Import business records",
                      reports: "Financial reports",
                      periods: "Period closing",
                    } as Record<string, string>
                  )[t]
                }
              </button>
            ),
          )}
        </div>
      </div>
      {message && null}
      {error && null}
      {tab === "journals" && (
        <section className="panel">
          <div className="toolbar">
            <h3>Draft and posted journals</h3>
            {config.write && (
              <button onClick={() => setEditing(null)}>
                Prepare a journal
              </button>
            )}
          </div>
          {!journals.length && (
            <p>
              No journals yet. Prepare opening entries after reviewing the
              company’s balances, or import eligible business records as drafts.
            </p>
          )}
          {journals.map((j) => (
            <details className="operation-record" key={j.id}>
              <summary>
                {j.reference} · {j.entry_date} · {j.status} · {j.description}
              </summary>
              <table>
                <thead>
                  <tr>
                    <th>Account</th>
                    <th>Debit</th>
                    <th>Credit</th>
                  </tr>
                </thead>
                <tbody>
                  {j.lines.map((l, i) => (
                    <tr key={i}>
                      <td>
                        {l.account} ·{" "}
                        {accounts.find((a) => a.code === l.account)?.name}
                      </td>
                      <td className="numeric">
                        {money(l.debit_minor, j.currency)}
                      </td>
                      <td className="numeric">
                        {money(l.credit_minor, j.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="actions">
                {j.status === "draft" && config.write && !j.source_key && (
                  <button className="secondary" onClick={() => setEditing(j)}>
                    Edit draft
                  </button>
                )}
                {j.status === "draft" && config.post && (
                  <button
                    onClick={async () => {
                      setError("");
                      try {
                        await api("suite/journal-post", {
                          id: j.id,
                          version: j.version,
                        });
                        await done();
                      } catch (e) {
                        setError(e as Error);
                      }
                    }}
                  >
                    Post balanced journal
                  </button>
                )}
                {j.status === "draft" && config.write && (
                  <button
                    className="secondary"
                    onClick={async () => {
                      if (
                        !(await confirmAction({
                          title: "Delete this journal draft?",
                          message:
                            "This unposted draft will be removed. Its deletion remains in the activity history.",
                          confirmLabel: "Delete draft",
                          danger: true,
                        }))
                      )
                        return;
                      try {
                        await api("suite/journal-delete", {
                          id: j.id,
                          version: j.version,
                        });
                        await done();
                      } catch (e) {
                        setError(e as Error);
                      }
                    }}
                  >
                    Delete draft
                  </button>
                )}
                {j.status === "posted" && config.post && (
                  <button
                    className="secondary"
                    onClick={async () => {
                      const reason = await requestReason({
                        title: "Create a correcting reversal?",
                        message:
                          "Enter a reason of at least five characters. The original posted journal will be retained in the audit trail.",
                        confirmLabel: "Create reversal",
                      });
                      if (!reason) return;
                      try {
                        await api("suite/journal-reverse", {
                          id: j.id,
                          version: j.version,
                          entry_date: today(),
                          reason,
                          request_key: crypto.randomUUID(),
                        });
                        await done();
                      } catch (e) {
                        setError(e as Error);
                      }
                    }}
                  >
                    Create reversing entry
                  </button>
                )}
              </div>
            </details>
          ))}
          <div className="actions">
            <button
              className="secondary"
              disabled={!page}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous journals
            </button>
            <span>Page {page + 1}</span>
            <button
              className="secondary"
              disabled={!more}
              onClick={() => setPage((p) => p + 1)}
            >
              Next journals
            </button>
          </div>
        </section>
      )}
      {tab === "accounts" && (
        <Accounts accounts={accounts} owner={config.owner} refresh={load} />
      )}
      {tab === "sources" && (
        <SourceImport
          accounts={accounts}
          writable={config.write}
          onSaved={done}
        />
      )}
      {tab === "reports" && <Reports config={config} />}
      {tab === "periods" && <Periods config={config} refresh={refresh} />}
    </>
  );
}
function JournalEditor({
  accounts,
  record,
  onBack,
  onSaved,
}: {
  accounts: LedgerAccount[];
  record: LedgerJournal | null;
  onBack: () => void;
  onSaved: () => Promise<void>;
}) {
  const [date, setDate] = useState(record?.entry_date || today()),
    [currency, setCurrency] = useState(record?.currency || "NGN"),
    [description, setDescription] = useState(record?.description || ""),
    [cash, setCash] = useState(record?.cash_flow || "none"),
    [lines, setLines] = useState(
      record?.lines.map((l) => ({
        account: l.account,
        debit: (l.debit_minor / 100).toFixed(2),
        credit: (l.credit_minor / 100).toFixed(2),
      })) || [
        { account: "1000", debit: "", credit: "" },
        { account: "3000", debit: "", credit: "" },
      ],
    ),
    [key] = useState(() => crypto.randomUUID()),
    [dirty, setDirty] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useFeedback("error");
  useUnsavedChanges(dirty);
  const edit = (i: number, k: string, value: string) => {
    setLines((old) => old.map((l, j) => (j === i ? { ...l, [k]: value } : l)));
    setDirty(true);
  };
  return (
    <section className="panel">
      <div className="toolbar">
        <h2>{record ? "Edit journal draft" : "Prepare a journal"}</h2>
        <button className="secondary" onClick={onBack}>
          Back to journals
        </button>
      </div>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            const payload = {
              entry_date: date,
              currency,
              description,
              cash_flow: cash,
              lines: lines.map((l) => ({
                account: l.account,
                debit_minor: minor(l.debit || "0"),
                credit_minor: minor(l.credit || "0"),
              })),
            };
            await api(record ? "suite/journal-update" : "suite/journal-save", {
              request_key: key,
              ...(record ? { id: record.id, version: record.version } : {}),
              data: payload,
            });
            setDirty(false);
            await onSaved();
          } catch (e) {
            setError(e as Error);
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="form-grid">
          <Field label="Journal date">
            <input
              type="date"
              required
              value={date}
              onChange={(e) => {
                setDate(e.target.value);
                setDirty(true);
              }}
            />
          </Field>
          <Field label="Journal currency">
            <select
              value={currency}
              onChange={(e) => {
                setCurrency(e.target.value);
                setDirty(true);
              }}
            >
              {["NGN", "USD", "GBP", "EUR"].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Field>
          <Field label="Journal description">
            <input
              required
              minLength={5}
              maxLength={500}
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                setDirty(true);
              }}
            />
          </Field>
          <Field label="Cash-flow classification">
            <select
              value={cash}
              onChange={(e) => {
                setCash(e.target.value);
                setDirty(true);
              }}
            >
              {["none", "operating", "investing", "financing"].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Field>
        </div>
        {lines.map((l, i) => (
          <fieldset key={i} className="journal-line">
            <legend>Journal line {i + 1}</legend>
            <div className="form-grid">
              <Field label={`Account for line ${i + 1}`}>
                <select
                  value={l.account}
                  onChange={(e) => edit(i, "account", e.target.value)}
                >
                  {accounts.map((a) => (
                    <option key={a.code} value={a.code}>
                      {a.code} · {a.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={`Debit for line ${i + 1}`}>
                <input
                  inputMode="decimal"
                  type="number"
                  min="0"
                  step="0.01"
                  value={l.debit}
                  onChange={(e) => edit(i, "debit", e.target.value)}
                />
              </Field>
              <Field label={`Credit for line ${i + 1}`}>
                <input
                  inputMode="decimal"
                  type="number"
                  min="0"
                  step="0.01"
                  value={l.credit}
                  onChange={(e) => edit(i, "credit", e.target.value)}
                />
              </Field>
            </div>
            {lines.length > 2 && (
              <button
                type="button"
                className="secondary"
                onClick={() => {
                  setLines((old) => old.filter((_, j) => j !== i));
                  setDirty(true);
                }}
              >
                Remove line {i + 1}
              </button>
            )}
          </fieldset>
        ))}
        <p>
          A draft may be saved for review. Posting requires a positive debit or
          credit on every line and equal total debits and credits.
        </p>
        {error && null}
        <div className="actions">
          <button
            type="button"
            className="secondary"
            disabled={lines.length >= 50}
            onClick={() => {
              setLines((old) => [
                ...old,
                { account: accounts[0]?.code || "1000", debit: "", credit: "" },
              ]);
              setDirty(true);
            }}
          >
            Add journal line
          </button>
          <button disabled={busy}>
            {busy ? "Saving…" : "Save journal draft"}
          </button>
        </div>
      </form>
    </section>
  );
}
function Accounts({
  accounts,
  owner,
  refresh,
}: {
  accounts: LedgerAccount[];
  owner: boolean;
  refresh: () => Promise<void>;
}) {
  const [error, setError] = useFeedback("error");
  return (
    <section className="panel">
      <h3>Chart of accounts</h3>
      <div className="table-scroll" tabIndex={0}>
        <table>
          <thead>
            <tr>
              <th>Code</th>
              <th>Account</th>
              <th>Type</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((a) => (
              <tr key={a.code}>
                <td className="document-reference">{a.code}</td>
                <td>
                  {a.name}
                  {a.cash_account ? " · Cash/bank" : ""}
                </td>
                <td>{a.category}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {owner && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const f = e.currentTarget;
            const d = new FormData(f);
            try {
              await api("suite/account", {
                code: String(d.get("code")).toUpperCase(),
                name: d.get("name"),
                category: d.get("category"),
                cash_account: d.get("cash") === "on",
              });
              f.reset();
              setError("");
              await refresh();
            } catch (e) {
              setError(e as Error);
            }
          }}
        >
          <h3>Add a company account</h3>
          <div className="form-grid">
            <Field label="Account code">
              <input
                name="code"
                required
                pattern="[A-Za-z0-9-]{2,20}"
                maxLength={20}
              />
            </Field>
            <Field label="Account name">
              <input name="name" required maxLength={160} />
            </Field>
            <Field label="Account category">
              <select name="category">
                {["asset", "liability", "equity", "income", "expense"].map(
                  (c) => (
                    <option key={c}>{c}</option>
                  ),
                )}
              </select>
            </Field>
            <Field label="This is a cash or bank account">
              <input name="cash" type="checkbox" />
            </Field>
          </div>
          <button>Add account</button>
        </form>
      )}
      {error && null}
    </section>
  );
}
function SourceImport({
  accounts,
  writable,
  onSaved,
}: {
  accounts: LedgerAccount[];
  writable: boolean;
  onSaved: () => Promise<void>;
}) {
  const [table, setTable] = useState("work_commercial"),
    [rows, setRows] = useState<Record<string, unknown>[]>([]),
    [selected, setSelected] = useState(""),
    [account, setAccount] = useState("6000"),
    [error, setError] = useFeedback("error"),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    setSelected("");
    api<{ rows: Record<string, unknown>[] }>(`suite/sources?table=${table}`)
      .then((r) => setRows(r.rows))
      .catch((e) => setError(e));
  }, [table]);
  return (
    <section className="panel">
      <h3>Import a business record as a journal draft</h3>
      <p>
        Review every imported draft before posting. An invoice records revenue;
        a payment records bank money and a customer deposit; allocation settles
        the invoice. Receipts are not imported again as separate sales. Sources
        before the accounting start date belong in reviewed opening balances.
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await api("suite/source", {
              source_table: table,
              source_id: selected,
              ...(table === "work_expenses" ? { debit_account: account } : {}),
              request_key: crypto.randomUUID(),
            });
            setError("");
            await onSaved();
          } catch (e) {
            setError(e as Error);
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="form-grid">
          <Field label="Accounting source type">
            <select value={table} onChange={(e) => setTable(e.target.value)}>
              {Object.entries({
                work_commercial: "Issued invoices and credits",
                work_payments: "Confirmed customer payments",
                work_allocations: "Invoice payment allocations",
                work_expenses: "Approved bills and expenses",
                work_supplier_payments: "Supplier payments",
                work_refunds: "Customer refunds",
              }).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Accounting source record">
            <select
              required
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
            >
              <option value="">Choose a source…</option>
              {rows.map((r) => (
                <option key={String(r.id)} value={String(r.id)}>
                  {String(r.number || r.title || r.reference || r.id)} ·{" "}
                  {String(
                    r.document_date ||
                      r.paid_on ||
                      r.incurred_on ||
                      r.created_at ||
                      "",
                  ).slice(0, 10)}{" "}
                  ·{" "}
                  {money(
                    Number(r.total_minor ?? r.amount_minor ?? 0),
                    String(r.currency || "NGN"),
                  )}
                </option>
              ))}
            </select>
          </Field>
          {table === "work_expenses" && (
            <Field label="Bill debit account">
              <select
                value={account}
                onChange={(e) => setAccount(e.target.value)}
              >
                {accounts
                  .filter(
                    (a) => a.category === "expense" || a.category === "asset",
                  )
                  .map((a) => (
                    <option key={a.code} value={a.code}>
                      {a.code} · {a.name}
                    </option>
                  ))}
              </select>
            </Field>
          )}
        </div>
        {error && null}
        <button disabled={!writable || busy || !selected}>
          {busy ? "Importing…" : "Prepare source journal"}
        </button>
      </form>
    </section>
  );
}
function Reports({ config }: { config: SuiteConfig }) {
  const [from, setFrom] = useState(
      () =>
        accountingPeriod(
          today(),
          config.accounting_start ||
            config.setup?.payload.accounting.cutover ||
            today().slice(0, 4) + "-01-01",
          config.financial_year_end ||
            config.setup?.payload.accounting.year_end ||
            "12-31",
        )?.from || today(),
    ),
    [to, setTo] = useState(today()),
    [currency, setCurrency] = useState("NGN"),
    [report, setReport] = useState<LedgerReport | null>(null),
    [error, setError] = useFeedback("error");
  const load = useCallback(async () => {
    try {
      if (from > to) throw Error("The start date must be before the end date.");
      setReport(await api<LedgerReport>(`suite/reports?from=${from}&to=${to}`));
      setError("");
    } catch (e) {
      setError(e as Error);
    }
  }, [from, to]);
  useEffect(() => {
    void load();
  }, [load]);
  const s = report ? reportSummary(report, currency) : null;
  return (
    <section className="panel">
      <h3>Posted accounting reports</h3>
      <div className="actions">
        <a href={`/api/suite/report-export?from=${from}&to=${to}`} download>
          Export general ledger CSV
        </a>
        <a
          href={`/api/suite/report-export?kind=trial&from=${from}&to=${to}`}
          download
        >
          Export trial balance CSV
        </a>
      </div>
      <div className="form-grid">
        <Field label="Report from">
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </Field>
        <Field label="Report through">
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </Field>
        <Field label="Report currency">
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
          >
            {["NGN", "USD", "GBP", "EUR"].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Field>
      </div>
      <p>
        Profit and loss uses the selected period. Balance-sheet and
        trial-balance figures include all posted entries through the end date.
        Currencies are not consolidated or automatically translated.
      </p>
      {error && null}
      {s && report && (
        <>
          <div className="notice">
            <strong>Source reconciliation</strong>
            <p>
              {report.pending_count || 0} business record(s) still need a posted
              source journal. {report.changed_count || 0} posted source(s)
              changed and require accounting review.
            </p>
            {(report.pending_sources || []).slice(0, 10).map((r) => (
              <p key={r.tbl + r.id}>
                {r.dt} ·{" "}
                {r.label || r.tbl.replaceAll("work_", "").replaceAll("_", " ")}{" "}
                · awaiting posting
              </p>
            ))}
            {(report.changed_sources || []).slice(0, 10).map((r) => (
              <p key={r.tbl + r.id}>
                {r.dt} · {r.label || r.tbl} · changed after posting
              </p>
            ))}
          </div>
          <h4>Profit and loss</h4>
          <dl className="record-summary">
            <div>
              <dt>Income</dt>
              <dd className="numeric">{money(s.revenue, currency)}</dd>
            </div>
            <div>
              <dt>Expenses</dt>
              <dd className="numeric">{money(s.expenses, currency)}</dd>
            </div>
            <div>
              <dt>Profit / loss</dt>
              <dd className="numeric">{money(s.profit, currency)}</dd>
            </div>
          </dl>
          <h4>Balance sheet</h4>
          <dl className="record-summary">
            <div>
              <dt>Assets</dt>
              <dd className="numeric">{money(s.assets, currency)}</dd>
            </div>
            <div>
              <dt>Liabilities</dt>
              <dd className="numeric">{money(s.liabilities, currency)}</dd>
            </div>
            <div>
              <dt>Equity before unclosed earnings</dt>
              <dd className="numeric">{money(s.equity, currency)}</dd>
            </div>
            <div>
              <dt>Unclosed earnings</dt>
              <dd className="numeric">{money(s.earnings, currency)}</dd>
            </div>
          </dl>
          <h4>Trial balance</h4>
          <div className="table-scroll" tabIndex={0}>
            <table>
              <thead>
                <tr>
                  <th>Account</th>
                  <th>Debit</th>
                  <th>Credit</th>
                </tr>
              </thead>
              <tbody>
                {report.balances
                  .filter((b) => b.currency === currency)
                  .map((b) => (
                    <tr key={b.code}>
                      <td>
                        <span className="document-reference">{b.code}</span> ·{" "}
                        {b.name}
                      </td>
                      <td className="numeric">
                        {money(Math.max(0, Number(b.balance_minor)), currency)}
                      </td>
                      <td className="numeric">
                        {money(Math.max(0, -Number(b.balance_minor)), currency)}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          <p role="status">
            Trial balance difference: {money(s.trialDifference, currency)}
          </p>
          <h4>Cash movement by classification</h4>
          {["operating", "investing", "financing", "none"].map((k) => {
            const amount = report.activity
              .filter(
                (a) =>
                  a.currency === currency &&
                  a.cash_flow === k &&
                  report.balances.some(
                    (b) =>
                      b.currency === currency &&
                      b.code === a.account &&
                      b.cash_account,
                  ),
              )
              .reduce(
                (sum, a) =>
                  sum + Number(a.debit_minor) - Number(a.credit_minor),
                0,
              );
            return (
              <p key={k}>
                {k === "none" ? "Unclassified" : k}: {money(amount, currency)}
              </p>
            );
          })}
          <h4>General ledger activity</h4>
          <div className="table-scroll" tabIndex={0}>
            <table>
              <thead>
                <tr>
                  <th>Date / journal</th>
                  <th>Account</th>
                  <th>Debit</th>
                  <th>Credit</th>
                </tr>
              </thead>
              <tbody>
                {report.activity
                  .filter((a) => a.currency === currency)
                  .map((a, i) => (
                    <tr key={i}>
                      <td>
                        {a.entry_date} ·{" "}
                        <span className="document-reference">
                          {a.reference}
                        </span>
                        <small>{a.description}</small>
                      </td>
                      <td className="document-reference">{a.account}</td>
                      <td className="numeric">
                        {money(Number(a.debit_minor), currency)}
                      </td>
                      <td className="numeric">
                        {money(Number(a.credit_minor), currency)}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
function Periods({
  config,
  refresh,
}: {
  config: SuiteConfig;
  refresh: () => Promise<void>;
}) {
  const [through, setThrough] = useState(today()),
    [reason, setReason] = useState(""),
    [reconciled, setReconciled] = useState(false),
    [error, setError] = useFeedback("error"),
    [message, setMessage] = useFeedback();
  const act = async (action: string) => {
    try {
      await api("suite/" + action, { through, reason, reconciled });
      setError("");
      setMessage(
        action === "close"
          ? "The period is closed."
          : "The owner reopened the period; the reason is recorded.",
      );
      await refresh();
    } catch (e) {
      setError(e as Error);
    }
  };
  return (
    <section className="panel">
      <h3>Close and reopen accounting periods</h3>
      <p>
        Closed through: {config.closed_through || "No period closed"}. Review
        bank matching, opening balances, source posting, deposits, stock and tax
        treatment before closing. Draft journals dated within the period must be
        resolved.
      </p>
      <div className="form-grid">
        <Field label="Close through date">
          <input
            type="date"
            max={today()}
            value={through}
            onChange={(e) => setThrough(e.target.value)}
          />
        </Field>
        <Field label="Closing or reopening reason">
          <input
            minLength={5}
            maxLength={500}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </Field>
        <Field label="I reconciled the bank accounts, balances and underlying records">
          <input
            type="checkbox"
            checked={reconciled}
            onChange={(e) => setReconciled(e.target.checked)}
          />
        </Field>
      </div>
      <div className="actions">
        <button
          disabled={!config.close || !reconciled || reason.length < 5}
          onClick={() => void act("close")}
        >
          Close period
        </button>
        {config.owner && config.closed_through && (
          <button
            className="secondary"
            disabled={!reconciled || reason.length < 5}
            onClick={() => void act("reopen")}
          >
            Owner: reopen period
          </button>
        )}
      </div>
      {error && null}
      {message && null}
    </section>
  );
}
