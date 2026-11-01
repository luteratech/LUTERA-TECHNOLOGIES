"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import { useUnsavedChanges } from "@/lib/unsaved";
import type { SuiteConfig } from "@/lib/suite";
export default function UserResponsibilities() {
  const [config, setConfig] = useState<SuiteConfig | null>(null),
    [email, setEmail] = useState(""),
    [title, setTitle] = useState(""),
    [duties, setDuties] = useState(""),
    [post, setPost] = useState(false),
    [close, setClose] = useState(false),
    [sign, setSign] = useState(false),
    [dirty, setDirty] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  useUnsavedChanges(dirty);
  useEffect(() => {
    api<SuiteConfig>("suite/config")
      .then(setConfig)
      .catch((e) => setError(e.message));
  }, []);
  if (!config)
    return (
      <p role={error ? "alert" : "status"}>
        {error || "Loading colleague responsibilities…"}
      </p>
    );
  if (!config.owner) return null;
  const choose = (value: string) => {
    const r = config.responsibilities.find((r) => r.email === value);
    setEmail(value);
    setTitle(r?.title || "");
    setDuties(r?.duties || "");
    setPost(r?.ledger_post || false);
    setClose(r?.period_close || false);
    setSign(r?.sign_documents || false);
    setDirty(false);
    setMessage("");
  };
  return (
    <section className="panel">
      <h2>Responsibilities and sensitive authority</h2>
      <p>
        Your Owner authority remains available while you run the company alone.
        When colleagues join, first approve their account under User access,
        then assign department grants and the responsibilities below. Posting,
        closing and signing also require access to the underlying records.
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            await api("suite/responsibilities", {
              email,
              title,
              duties,
              ledger_post: post,
              period_close: close,
              sign_documents: sign,
            });
            setDirty(false);
            setMessage("Responsibilities and authority saved.");
            setConfig(await api<SuiteConfig>("suite/config"));
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="form-grid">
          <label className="field">
            <span>Approved colleague</span>
            <select
              aria-label="Approved colleague"
              required
              value={email}
              onChange={(e) => {
                if (
                  dirty &&
                  !confirm("Discard these unsaved responsibilities?")
                )
                  return;
                choose(e.target.value);
              }}
            >
              <option value="">Choose an approved colleague…</option>
              {config.members
                .filter((m) => m.active && m.role !== "owner")
                .map((m) => (
                  <option key={m.email} value={m.email}>
                    {m.email} · {m.role}
                  </option>
                ))}
            </select>
          </label>
          <label className="field">
            <span>Job title or responsibility label</span>
            <input
              maxLength={100}
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                setDirty(true);
              }}
              placeholder="Sales and procurement, project manager, accountant…"
            />
          </label>
          <label className="field">
            <span>Assigned responsibilities</span>
            <textarea
              rows={4}
              maxLength={2000}
              value={duties}
              onChange={(e) => {
                setDuties(e.target.value);
                setDirty(true);
              }}
            />
          </label>
          <label className="field">
            <span>May post balanced accounting journals</span>
            <input
              type="checkbox"
              checked={post}
              onChange={(e) => {
                setPost(e.target.checked);
                setDirty(true);
              }}
            />
          </label>
          <label className="field">
            <span>May close reconciled accounting periods</span>
            <input
              type="checkbox"
              checked={close}
              onChange={(e) => {
                setClose(e.target.checked);
                setDirty(true);
              }}
            />
          </label>
          <label className="field">
            <span>May sign authorised documents with their own signature</span>
            <input
              type="checkbox"
              checked={sign}
              onChange={(e) => {
                setSign(e.target.checked);
                setDirty(true);
              }}
            />
          </label>
        </div>
        <p>
          Permissions do not authorise using another person’s signature.
          Reopening a closed period remains owner-only. Staff accounts begin
          without website or finance access unless you grant it.
        </p>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {message && (
          <p className="notice" role="status">
            {message}
          </p>
        )}
        <button disabled={busy || !email}>
          {busy ? "Saving…" : "Save responsibilities"}
        </button>
      </form>
    </section>
  );
}
