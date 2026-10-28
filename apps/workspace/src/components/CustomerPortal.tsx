"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import { money } from "@/lib/contracts";
type Share = {
  id: string;
  number: string;
  kind: string;
  currency: string;
  total_minor: number;
};
type State = {
  acceptance_requests?: {
    id: string;
    prompt: string;
    status: string;
    document: string;
  }[];
  email: string;
  customers: { id: string; name: string }[];
  documents: Share[];
  work?: {
    reference: string;
    title: string;
    kind: string;
    status: string;
    due_on: string;
    milestones: { title: string; status: string; due_on: string }[];
  }[];
};
export default function CustomerPortal() {
  const [ticketTitle, setTicketTitle] = useState(""),
    [ticketBody, setTicketBody] = useState(""),
    [ticketCustomer, setTicketCustomer] = useState("");
  const [token, setToken] = useState(""),
    [state, setState] = useState<State | null>(null),
    [email, setEmail] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [document, setDocument] = useState<Record<string, unknown> | null>(null),
    [selected, setSelected] = useState<Share | null>(null),
    [confirmed, setConfirmed] = useState(false);
  const refresh = async () => {
    try {
      setState(await api<State>("portal/session"));
    } catch {
      setState(null);
    }
  };
  useEffect(() => {
    const value =
      new URLSearchParams(window.location.hash.slice(1)).get("token") || "";
    if (/^[a-f0-9]{64}$/.test(value)) {
      setToken(value);
      history.replaceState(null, "", location.pathname);
    } else void refresh();
  }, []);
  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setMessage("");
    try {
      await fn();
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const rec = (document?.legacy || document?.record) as
    | Record<string, unknown>
    | undefined;
  const payload = (rec?.payload || {}) as Record<string, unknown>;
  const lines = (document?.lines || payload.items || []) as {
    description: string;
    quantity: number;
    unit_minor: number;
  }[];
  return (
    <main className="portal-shell">
      <header className="portal-header">
        <a href="https://luteratech.com">
          <img
            src="/brand/lutera-horizontal-light.svg"
            alt="Lutera Technology Ltd"
            width="160"
            height="44"
          />
        </a>
        <span>Customer portal</span>
      </header>
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
      {token ? (
        <section className="panel">
          <h1>Continue to your customer portal</h1>
          <p>
            This one-time sign-in link expires after 15 minutes. Continue only
            if you requested it.
          </p>
          <button
            disabled={busy}
            onClick={() =>
              void run(async () => {
                await api("portal/exchange", { token });
                setToken("");
                await refresh();
              })
            }
          >
            Continue securely
          </button>
        </section>
      ) : !state ? (
        <section className="panel">
          <p className="eyebrow">Your work with Lutera</p>
          <h1>Sign in to view shared documents.</h1>
          <p>Use the email address approved by Lutera for your organization.</p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                const r = await api<{ message: string }>("portal/request", {
                  email,
                });
                setMessage(r.message);
              });
            }}
          >
            <label className="field">
              <span>Email address</span>
              <input
                type="email"
                autoComplete="email"
                required
                maxLength={254}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <button disabled={busy}>Email me a sign-in link</button>
          </form>
        </section>
      ) : (
        <>
          <section className="panel">
            <div className="toolbar">
              <div>
                <h1>
                  {state.customers.map((c) => c.name).join(" · ") ||
                    "Your customer portal"}
                </h1>
                <p>{state.email}</p>
              </div>
              <button
                className="secondary"
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    await api("portal/signout", {});
                    setState(null);
                    setDocument(null);
                  })
                }
              >
                Sign out
              </button>
            </div>
            <p>
              Only documents explicitly shared with your organization appear
              here.
            </p>
            {state.documents.length ? (
              <div className="portal-documents">
                {state.documents.map((s) => (
                  <article className="card" key={s.id}>
                    <span className="badge">{s.kind}</span>
                    <h2>{s.number}</h2>
                    <p>{money(s.total_minor, s.currency)}</p>
                    <button
                      className="secondary"
                      disabled={busy}
                      onClick={() =>
                        void run(async () => {
                          setDocument(
                            await api<Record<string, unknown>>(
                              "portal/document?id=" + s.id,
                            ),
                          );
                          setSelected(s);
                          setConfirmed(false);
                        })
                      }
                    >
                      View document
                    </button>
                  </article>
                ))}
              </div>
            ) : (
              <p>No documents have been shared yet.</p>
            )}
          </section>
          {!!state.acceptance_requests?.length && (
            <section className="panel">
              <h2>Requested acceptance evidence</h2>
              <p>
                Upload only the evidence Lutera requested. PDF, JPEG, PNG or
                WebP, up to 1 MB.
              </p>
              {state.acceptance_requests.map((r) => (
                <article className="operation-record" key={r.id}>
                  <h3>{r.document}</h3>
                  <p>{r.prompt}</p>
                  {r.status === "completed" ? (
                    <p>Evidence received.</p>
                  ) : (
                    <label className="field">
                      <span>Upload evidence for {r.document}</span>
                      <input
                        type="file"
                        accept="application/pdf,image/jpeg,image/png,image/webp"
                        disabled={busy}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          void run(async () => {
                            if (file.size > 1048576)
                              throw new Error(
                                "Choose a document or image under 1 MB.",
                              );
                            const bytes = new Uint8Array(
                              await file.arrayBuffer(),
                            );
                            let binary = "";
                            for (let i = 0; i < bytes.length; i += 8192)
                              binary += String.fromCharCode(
                                ...bytes.subarray(i, i + 8192),
                              );
                            await api("portal/evidence", {
                              request_id: r.id,
                              name: file.name.slice(0, 160),
                              data: btoa(binary),
                            });
                            await refresh();
                            setMessage(
                              "Acceptance evidence uploaded successfully.",
                            );
                          });
                          e.target.value = "";
                        }}
                      />
                    </label>
                  )}
                </article>
              ))}
            </section>
          )}
          {rec && selected && (
            <section className="panel">
              <h2>{String(rec.number)}</h2>
              <a
                className="button secondary"
                href={"/api/portal/download?id=" + selected.id}
              >
                Download PDF ↗
              </a>
              <p>
                {String(rec.kind)} ·{" "}
                {String(rec.document_date || payload.date || "")}
              </p>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Description</th>
                      <th>Quantity</th>
                      <th>Unit price</th>
                      <th>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((l, i) => (
                      <tr key={i}>
                        <td>{l.description}</td>
                        <td>{l.quantity}</td>
                        <td>{money(l.unit_minor, selected.currency)}</td>
                        <td>
                          {money(l.quantity * l.unit_minor, selected.currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="ops-total">
                Total{" "}
                <strong>
                  {money(Number(rec.total_minor), selected.currency)}
                </strong>
              </p>
              <p className="preserve-lines">
                {String(rec.notes || payload.notes || "")}
              </p>
              {rec.kind === "quotation" && (
                <div>
                  <label className="check">
                    <input
                      type="checkbox"
                      checked={confirmed}
                      onChange={(e) => setConfirmed(e.target.checked)}
                    />
                    I accept this quotation and its stated terms on behalf of my
                    organization.
                  </label>
                  <button
                    disabled={busy || !confirmed}
                    onClick={() =>
                      void run(async () => {
                        await api("portal/accept", {
                          share_id: selected.id,
                          confirmed: true,
                        });
                        setMessage(
                          "Your acceptance has been recorded. Lutera will confirm the next steps.",
                        );
                        setConfirmed(false);
                        await refresh();
                      })
                    }
                  >
                    Record acceptance
                  </button>
                  <button
                    className="secondary"
                    disabled={busy}
                    onClick={() => {
                      if (
                        window.confirm(
                          "Decline this quotation revision? Lutera will receive your decision.",
                        )
                      )
                        void run(async () => {
                          await api("portal/decline", {
                            share_id: selected.id,
                            confirmed: true,
                          });
                          setMessage("Your decision has been recorded.");
                          await refresh();
                        });
                    }}
                  >
                    Decline quotation
                  </button>
                </div>
              )}
            </section>
          )}
          {Boolean(state.work?.length) && (
            <section className="panel">
              <h2>Projects and support</h2>
              {state.work?.map((w) => (
                <article key={w.reference}>
                  <h3>{w.title}</h3>
                  <p>
                    {w.reference} · {w.status}
                    {w.due_on ? " · Target " + w.due_on : ""}
                  </p>
                  <ul>
                    {w.milestones.map((m, i) => (
                      <li key={i}>
                        {m.title} · {m.status}
                        {m.due_on ? " · " + m.due_on : ""}
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </section>
          )}
          <section className="panel">
            <h2>Raise a support request</h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void run(async () => {
                  const r = await api<{ reference: string }>("portal/ticket", {
                    customer_id: ticketCustomer || state.customers[0]?.id,
                    title: ticketTitle,
                    description: ticketBody,
                  });
                  setMessage("Support request received: " + r.reference);
                  setTicketTitle("");
                  setTicketBody("");
                  await refresh();
                });
              }}
            >
              <label className="field">
                <span>Organization</span>
                <select
                  required
                  value={ticketCustomer || state.customers[0]?.id || ""}
                  onChange={(e) => setTicketCustomer(e.target.value)}
                >
                  {state.customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Subject</span>
                <input
                  required
                  maxLength={200}
                  value={ticketTitle}
                  onChange={(e) => setTicketTitle(e.target.value)}
                />
              </label>
              <label className="field">
                <span>Describe the issue</span>
                <textarea
                  required
                  minLength={10}
                  maxLength={6000}
                  rows={4}
                  value={ticketBody}
                  onChange={(e) => setTicketBody(e.target.value)}
                />
              </label>
              <button disabled={busy || !state.customers.length}>
                Submit support request
              </button>
            </form>
          </section>
          <section className="panel">
            <h2>Need help?</h2>
            <p>
              Contact <a href="mailto:support@luteratech.com">Lutera</a> for
              project updates, document corrections or support.
            </p>
          </section>
        </>
      )}
    </main>
  );
}
