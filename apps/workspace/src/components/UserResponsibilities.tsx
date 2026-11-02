"use client";
import { useFeedback } from "@/lib/notifications";
import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import MultiSelect from "./MultiSelect";
import { mayLeave, useUnsavedChanges } from "@/lib/unsaved";
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
    [error, setError] = useFeedback("error"),
    [message, setMessage] = useFeedback();
  useUnsavedChanges(dirty);
  useEffect(() => {
    api<SuiteConfig>("suite/config")
      .then(setConfig)
      .catch((e) => setError(e));
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
            setError(e as Error);
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
              onChange={async (e) => {
                const selectedEmail = e.target.value;
                if (!(await mayLeave())) return;
                choose(selectedEmail);
              }}
            >
              <option value="">Choose an approved colleague…</option>
              {config.members
                .filter((m) => m.active && m.role !== "owner")
                .map((m) => (
                  <option key={m.email} value={m.email}>
                    {m.email} · {(m.roles || [m.role]).join(" · ")}
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
          <MultiSelect
            label="Approval authorities"
            options={[
              { value: "post", label: "May post balanced accounting journals" },
              {
                value: "close",
                label: "May close reconciled accounting periods",
              },
              {
                value: "sign",
                label: "May sign authorised documents with their own signature",
              },
            ]}
            value={[
              ...(post ? ["post"] : []),
              ...(close ? ["close"] : []),
              ...(sign ? ["sign"] : []),
            ]}
            onChange={(next) => {
              setPost(next.includes("post"));
              setClose(next.includes("close"));
              setSign(next.includes("sign"));
              setDirty(true);
            }}
            disabled={busy}
            hint="Choose any combination. Each action also requires access to its underlying business records."
          />
        </div>
        <p>
          Permissions do not authorise using another person’s signature.
          Reopening a closed period remains owner-only. Staff accounts begin
          without website or finance access unless you grant it.
        </p>
        {error && null}
        {message && null}
        <button disabled={busy || !email}>
          {busy ? "Saving…" : "Save responsibilities"}
        </button>
      </form>
    </section>
  );
}
