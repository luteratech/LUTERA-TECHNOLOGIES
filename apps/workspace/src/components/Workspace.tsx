"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import {
  can,
  roles,
  type Role,
  type Settings,
  type BusinessDocument,
  type Staff,
  type SiteContent,
} from "@/lib/contracts";
const Documents = dynamic(() => import("./documents"), {
  loading: () => <p role="status">Loading section…</p>,
});
import WorkspaceShell from "./WorkspaceShell";
import {
  workspaceLocation,
  useWorkspaceHistory,
} from "@/lib/workspace-navigation";
const OperationsDesk = dynamic(() => import("./OperationsDesk"), {
  loading: () => <p role="status">Loading section…</p>,
});
const StaffCards = dynamic(() => import("./staff"), {
  loading: () => <p role="status">Loading section…</p>,
});
const ContentEditor = dynamic(() => import("./content"), {
  loading: () => <p role="status">Loading section…</p>,
});
const Account = dynamic(() => import("./Account"), {
  loading: () => <p role="status">Loading section…</p>,
});
const BusinessActivity = dynamic(() => import("./BusinessActivity"), {
  loading: () => <p role="status">Loading section…</p>,
});
const BusinessReports = dynamic(() => import("./BusinessReports"), {
  loading: () => <p role="status">Loading section…</p>,
});
const BusinessAdministration = dynamic(
  () => import("./BusinessAdministration"),
  { loading: () => <p role="status">Loading section…</p> },
);
import BusinessWorkspace, { BusinessDashboard } from "./BusinessWorkspace";
import PasswordInput from "./PasswordInput";
import { api, saveFile } from "@/lib/client";
export { api, saveFile } from "@/lib/client";
import { useCooldown } from "@/lib/cooldown";
import { mayLeave, useUnsavedChanges } from "@/lib/unsaved";

export type Session = {
  email: string;
  role: Role;
  verified: boolean;
  factors: { id: string; name: string }[];
};
export type State = {
  documents: BusinessDocument[];
  staff: Staff[];
  audit: {
    id: number;
    actor: string;
    action: string;
    entity: string;
    entity_id: string;
    created_at: string;
  }[];
  members: { email: string; role: Role; active: boolean }[];
  content: { content: SiteContent; version: number } | null;
  settings: { payload: Settings; version: number } | null;
  publications: { id: string; status: string; created_at: string }[];
  publishing_connected: boolean;
};
export function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
export function Notice({ children }: { children: React.ReactNode }) {
  return (
    <p className="notice" role="status">
      {children}
    </p>
  );
}
export default function Workspace() {
  const [session, setSession] = useState<Session | null>(null),
    [loading, setLoading] = useState(true),
    [data, setData] = useState<State | null>(null),
    [tab, setTab] = useState("overview"),
    [documentId, setDocumentId] = useState<string | undefined>(undefined),
    [navigationVersion, setNavigationVersion] = useState(0),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const activeSession = useRef<Session | null>(null);
  const refresh = useCallback(async () => {
    setData(await api<State>("state"));
  }, []);
  const checkSession = useCallback(async () => {
    try {
      const next = await api<Session>("session");
      const previous = activeSession.current;
      activeSession.current = next;
      setSession(next);
      if (
        next.verified &&
        (!previous?.verified || previous.role !== next.role)
      ) {
        setTab(
          new URLSearchParams(window.location.search).get("account") ===
            "password"
            ? "account"
            : [
                  "operations",
                  "controls",
                  "reports",
                  "content",
                  "finance",
                  "staff",
                  "settings",
                  "business-settings",
                  "members",
                  "audit",
                  "backup",
                  "account",
                ].includes(
                  new URLSearchParams(window.location.search).get("section") ||
                    "",
                )
              ? new URLSearchParams(window.location.search).get("section")!
              : "overview",
        );
        setDocumentId(
          new URLSearchParams(location.search).get("document") || undefined,
        );
        await refresh();
      }
      if (!next.verified) setData(null);
    } catch {
      activeSession.current = null;
      setSession(null);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [refresh]);
  useEffect(() => {
    void checkSession();
    const timer = setInterval(() => void checkSession(), 60000);
    const visible = () => {
      if (document.visibilityState === "visible") void checkSession();
    };
    document.addEventListener("visibilitychange", visible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [checkSession]);
  const navigation = useWorkspaceHistory(!!session?.verified, (pop) => {
    const params = new URLSearchParams(location.search);
    const area = params.get("section") || "overview";
    setTab(
      [
        "overview",
        "account",
        "operations",
        "controls",
        "reports",
        "content",
        "finance",
        "staff",
        "settings",
        "business-settings",
        "members",
        "audit",
        "backup",
      ].includes(area)
        ? area
        : "overview",
    );
    if (pop) {
      setDocumentId(params.get("document") || undefined);
      setNavigationVersion((v) => v + 1);
      setError("");
      requestAnimationFrame(() =>
        document.getElementById("workspace-main")?.focus(),
      );
    }
  });
  const goToSection = (area: string, id?: string) => {
    if (!mayLeave()) return false;
    workspaceLocation({
      section: area,
      module: null,
      kind: null,
      record: null,
      control: null,
      document: id || null,
      documentKind: null,
      account: null,
      notice: null,
    });
    setTab(area);
    setDocumentId(id);
    setError("");
    return true;
  };
  async function signout() {
    if (!mayLeave()) return;
    setBusy(true);
    setError("");
    try {
      await api("auth/signout", {});
      activeSession.current = null;
      setSession(null);
      setData(null);
      setTab("overview");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const tabs = [
    ["overview", "Overview"],
    ["account", "My account"],
    ["operations", "Business operations"],
    ["controls", "Operational controls"],
    ["reports", "Management reports"],
    ["content", "Website"],
    ["finance", "Documents"],
    ["staff", "Staff & cards"],
    ["settings", "Company settings"],
    ["business-settings", "Operations settings"],
    ["members", "Access"],
    ["audit", "Activity"],
    ["backup", "Backups"],
  ].filter(
    ([area]) =>
      area === "overview" ||
      area === "account" ||
      area === "operations" ||
      area === "controls" ||
      (area === "reports" && !!session && can(session.role, "finance")) ||
      (session &&
        can(session.role, area === "business-settings" ? "members" : area)),
  );
  if (loading)
    return (
      <main className="auth-shell">
        <p role="status">Opening workspace…</p>
      </main>
    );
  if (!session) return <Login onSuccess={checkSession} />;
  if (!session.verified)
    return (
      <MFA session={session} onSuccess={checkSession} onSignout={signout} />
    );
  return (
    <WorkspaceShell
      tabs={tabs}
      active={tab}
      onSelect={goToSection}
      canBack={navigation.back}
      canForward={navigation.forward}
      onBack={() => navigation.go(-1)}
      onForward={() => navigation.go(1)}
      email={session.email}
      role={session.role}
      busy={busy}
      onSignout={signout}
    >
      <main id="workspace-main" tabIndex={-1}>
        <nav className="workspace-breadcrumb" aria-label="Breadcrumb">
          <button
            type="button"
            onClick={() => goToSection("overview")}
            disabled={tab === "overview"}
          >
            Workspace
          </button>
          <span aria-hidden="true">/</span>
          <span aria-current="page">
            {tabs.find(([area]) => area === tab)?.[1]}
          </span>
        </nav>
        <div className="page-heading">
          <div>
            <p className="eyebrow">Lutera Technology Ltd</p>
            <h1>{tabs.find(([area]) => area === tab)?.[1]}</h1>
          </div>
          <button
            className="secondary"
            onClick={() => {
              if (mayLeave()) refresh().catch((e) => setError(e.message));
            }}
          >
            Refresh
          </button>
        </div>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {!data ? (
          <Notice>Loading your records…</Notice>
        ) : (
          <div key={navigationVersion} className="workspace-page">
            {tab === "operations" && (
              <BusinessWorkspace
                onOpenDocument={(id) => goToSection("finance", id)}
              />
            )}
            {tab === "overview" && (
              <>
                <BusinessDashboard onOpen={() => goToSection("operations")} />
                <div className="stat-grid">
                  {[
                    ["Recent documents", data.documents.length],
                    [
                      "Drafts to review",
                      data.documents.filter((d) => d.status === "draft").length,
                    ],
                    ["Recent staff profiles", data.staff.length],
                  ].map(([label, value]) => (
                    <article className="stat" key={label}>
                      <span>{label}</span>
                      <strong>{value}</strong>
                    </article>
                  ))}
                </div>
                <section className="panel welcome">
                  <p className="eyebrow">Supply. Build. Connect.</p>
                  <h2>Make the next step a considered one.</h2>
                  <p>
                    Prepare a quotation, update your website draft, or create a
                    staff card. Issued financial documents are locked and every
                    change leaves an activity record.
                  </p>
                  <div className="actions">
                    {can(session.role, "finance") && (
                      <button onClick={() => goToSection("finance")}>
                        Prepare a document ↗
                      </button>
                    )}
                    {can(session.role, "content") && (
                      <button
                        className="secondary"
                        onClick={() => goToSection("content")}
                      >
                        Edit website
                      </button>
                    )}
                  </div>
                </section>
                <Notice>
                  Sessions expire after 12 hours. Signing out revokes this
                  account’s sessions on every device. Keep your authenticator
                  recovery arrangements with the company owner.
                </Notice>
              </>
            )}
            {tab === "finance" && (
              <Documents
                initialId={documentId}
                records={data.documents}
                settings={data.settings!.payload}
                refresh={refresh}
              />
            )}
            {tab === "staff" && (
              <StaffCards
                records={data.staff}
                settings={data.settings!.payload}
                refresh={refresh}
              />
            )}
            {tab === "content" && (
              <ContentEditor
                initial={data.content!}
                publications={data.publications}
                connected={data.publishing_connected}
                refresh={refresh}
              />
            )}
            {tab === "settings" && (
              <SettingsEditor
                owner={session.role === "owner"}
                initial={data.settings!}
                refresh={refresh}
              />
            )}
            {tab === "members" && (
              <Members records={data.members} refresh={refresh} />
            )}
            {tab === "controls" && <OperationsDesk />}
            {tab === "audit" && <BusinessActivity />}
            {tab === "business-settings" && <BusinessAdministration />}
            {tab === "reports" && <BusinessReports />}
            {tab === "backup" && <Backups />}
            {tab === "account" && <Account session={session} />}
          </div>
        )}
      </main>
    </WorkspaceShell>
  );
}
function Login({ onSuccess }: { onSuccess: () => Promise<void> }) {
  const cooldown = useCooldown();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      await api("auth/signin", {
        email: form.get("email"),
        password: form.get("password"),
      });
      await onSuccess();
    } catch (e) {
      cooldown.handle(e);
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="auth-shell">
      <section className="auth-brand">
        <img
          src="/brand/lutera-horizontal-dark.svg"
          alt="Lutera"
          width="170"
          height="49"
        />
        <div>
          <p className="eyebrow">Private business workspace</p>
          <h1>
            Good work.
            <br />
            Behind the scenes.
          </h1>
          <p>One place for the details that keep Lutera moving.</p>
        </div>
        <span>Supply. Build. Connect.</span>
      </section>
      <section className="auth-form">
        <p className="eyebrow">Approved accounts only</p>
        <h2>Welcome back.</h2>
        <p>Sign in, then verify with your authenticator app.</p>
        {typeof window !== "undefined" &&
          new URLSearchParams(window.location.search).get("notice") ===
            "password-changed" && (
            <p className="notice" role="status">
              Your password has been updated. Sign in with your new password.
            </p>
          )}
        <form onSubmit={submit}>
          <Field label="Work email">
            <input
              name="email"
              type="email"
              autoComplete="username"
              required
              maxLength={254}
            />
          </Field>
          <PasswordInput
            label="Password"
            name="password"
            autoComplete="current-password"
            required
            maxLength={256}
          />
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <button disabled={busy || cooldown.seconds > 0}>
            {cooldown.seconds > 0
              ? `Try again in ${cooldown.seconds}s`
              : busy
                ? "Signing in…"
                : "Continue securely ↗"}
          </button>
        </form>
        <p className="muted">
          Access or recovery help: contact the company owner. There is no public
          registration.
        </p>
      </section>
    </main>
  );
}
function MFA({
  session,
  onSuccess,
  onSignout,
}: {
  session: Session;
  onSuccess: () => Promise<void>;
  onSignout: () => Promise<void>;
}) {
  const cooldown = useCooldown();
  const [enrollment, setEnrollment] = useState<{
      id: string;
      qr: string;
      secret: string;
    } | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function enroll() {
    setBusy(true);
    setError("");
    try {
      setEnrollment(await api("mfa/enroll", {}));
    } catch (e) {
      cooldown.handle(e);
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function verify(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      await api("mfa/verify", {
        factorId: enrollment?.id || form.get("factor"),
        code: form.get("code"),
      });
      setEnrollment(null);
      await onSuccess();
    } catch (e) {
      cooldown.handle(e);
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="auth-shell mfa-shell">
      <section className="panel mfa-panel">
        <img
          src="/brand/lutera-horizontal-light.svg"
          width="140"
          height="40"
          alt="Lutera"
        />
        <h1>One more check.</h1>
        {cooldown.seconds > 0 && (
          <p className="notice" role="status">
            Try again in {cooldown.seconds} seconds.
          </p>
        )}
        <p>
          {session.factors.length
            ? "Enter the six-digit code from your authenticator app."
            : "Set up an authenticator app before opening private records."}
        </p>
        {!session.factors.length && !enrollment && (
          <button onClick={enroll} disabled={busy || cooldown.seconds > 0}>
            Set up authenticator
          </button>
        )}
        {enrollment && (
          <>
            <img
              className="qr"
              src={
                enrollment.qr.startsWith("data:")
                  ? enrollment.qr
                  : `data:image/svg+xml;charset=utf-8,${encodeURIComponent(enrollment.qr)}`
              }
              alt="Scan this QR code using your authenticator app"
              width="220"
              height="220"
            />
            <details>
              <summary>Enter the setup key manually</summary>
              <code className="secret">{enrollment.secret}</code>
            </details>
            <Notice>
              Store recovery instructions with the company owner. This setup key
              is shown only during enrollment.
            </Notice>
          </>
        )}
        {(session.factors.length > 0 || enrollment) && (
          <form onSubmit={verify}>
            {!enrollment && (
              <Field label="Authenticator">
                <select name="factor">
                  {session.factors.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name || "Authenticator"}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            <Field label="Six-digit code">
              <input
                name="code"
                inputMode="numeric"
                pattern="[0-9]{6}"
                autoComplete="one-time-code"
                maxLength={6}
                required
                autoFocus
              />
            </Field>
            <button disabled={busy || cooldown.seconds > 0}>
              {busy ? "Verifying…" : "Verify and open workspace"}
            </button>
          </form>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button className="text-button" onClick={onSignout}>
          Return to sign in
        </button>
      </section>
    </main>
  );
}
function SettingsEditor({
  owner,
  initial,
  refresh,
}: {
  owner: boolean;
  initial: { payload: Settings; version: number };
  refresh: () => Promise<void>;
}) {
  const [value, setValue] = useState(initial.payload),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  useEffect(() => setValue(initial.payload), [initial]);
  useUnsavedChanges(JSON.stringify(value) !== JSON.stringify(initial.payload));
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      await api("settings/save", { version: initial.version, payload: value });
      await refresh();
      setMessage(
        "Company document settings saved. Issued documents keep their original company snapshot.",
      );
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="panel" onSubmit={submit}>
      <h2>Document identity & payment details</h2>
      <p>
        These details appear on new documents and staff cards. Website contact
        details are edited separately in Website.
      </p>
      <div className="form-grid">
        {Object.entries(value.company).map(([key, field]) => (
          <Field key={key} label={key.replaceAll("_", " ")}>
            <input
              value={field}
              required
              maxLength={key === "address" ? 500 : 254}
              onChange={(e) =>
                setValue({
                  ...value,
                  company: { ...value.company, [key]: e.target.value },
                })
              }
            />
          </Field>
        ))}
        {(
          ["bank_name", "account_name", "account_number", "tax_id"] as const
        ).map((key) => (
          <Field key={key} label={key.replaceAll("_", " ") + " (optional)"}>
            <input
              value={value[key]}
              disabled={!owner}
              maxLength={160}
              onChange={(e) => setValue({ ...value, [key]: e.target.value })}
            />
          </Field>
        ))}
        <Field label="Default currency">
          <select
            value={value.currency}
            disabled={!owner}
            onChange={(e) =>
              setValue({
                ...value,
                currency: e.target.value as Settings["currency"],
              })
            }
          >
            {["NGN", "USD", "GBP", "EUR"].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Standard document notes (optional)">
        <textarea
          value={value.document_notes}
          maxLength={2000}
          rows={4}
          onChange={(e) =>
            setValue({ ...value, document_notes: e.target.value })
          }
        />
      </Field>
      <button disabled={busy}>
        {busy ? "Saving…" : "Save company settings"}
      </button>
      {message && <Notice>{message}</Notice>}
    </form>
  );
}
function Members({
  records,
  refresh,
}: {
  records: State["members"];
  refresh: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  async function save(email: string, role: Role, active: boolean) {
    setBusy(true);
    setMessage("");
    try {
      await api("members/save", { email, role, active });
      await refresh();
      setMessage(
        "Access rule saved. Newly approved users still need a verified Supabase Auth account before they can sign in.",
      );
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <form
        className="panel"
        onSubmit={(e) => {
          e.preventDefault();
          const form = new FormData(e.currentTarget);
          void save(String(form.get("email")), form.get("role") as Role, true);
        }}
      >
        <h2>Approve a colleague</h2>
        <p>
          Owner controls access and backups. Admin manages operational areas.
          Editor updates website content, finance manages financial documents,
          and designer manages staff cards. Every role requires MFA.
        </p>
        <div className="form-grid">
          <Field label="Email">
            <input type="email" name="email" required maxLength={254} />
          </Field>
          <Field label="Role">
            <select name="role" defaultValue="editor">
              {roles.map((role) => (
                <option key={role}>{role}</option>
              ))}
            </select>
          </Field>
        </div>
        <button disabled={busy}>Approve account</button>
        {message && <Notice>{message}</Notice>}
        <Notice>
          Approval does not send an email or create a password. Create the
          colleague’s account or send an invitation in the Supabase
          Authentication dashboard using the approved email. Branded email
          invitations let each person choose their own password. Never share
          passwords through this workspace.
        </Notice>
      </form>
      <section className="panel">
        <h2>Approved accounts</h2>
        {records.map((member) => (
          <div className="record-row" key={member.email}>
            <div>
              <strong>{member.email}</strong>
              <small>
                {member.role} · {member.active ? "Active" : "Disabled"}
              </small>
            </div>
            <button
              className="secondary"
              disabled={busy}
              onClick={() => save(member.email, member.role, !member.active)}
            >
              {member.active ? "Disable" : "Enable"}
            </button>
          </div>
        ))}
      </section>
    </>
  );
}
function Backups() {
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  return (
    <form
      className="panel"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget,
          values = new FormData(form);
        if (values.get("password") !== values.get("confirmation")) {
          setMessage("Backup passwords must match");
          return;
        }
        setBusy(true);
        setMessage("");
        try {
          await saveFile("backup", { password: values.get("password") });
          form.reset();
          setMessage(
            "Encrypted backup downloaded. Keep it in a company-controlled backup location and store its password separately.",
          );
        } catch (error) {
          setMessage((error as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2>Download an encrypted records backup</h2>
      <p>
        Includes documents, staff photos, content, access rules, numbering
        counters and activity history. Passwords and authenticator secrets are
        excluded. This manual export complements the project’s database backup
        policy.
      </p>
      <div className="form-grid">
        <PasswordInput
          label="Backup password (at least 16 characters)"
          name="password"
          minLength={16}
          maxLength={256}
          required
          autoComplete="new-password"
        />
        <PasswordInput
          label="Confirm backup password"
          name="confirmation"
          minLength={16}
          maxLength={256}
          required
          autoComplete="new-password"
        />
      </div>
      <button disabled={busy}>
        {busy ? "Encrypting backup…" : "Download encrypted backup"}
      </button>
      {message && <Notice>{message}</Notice>}
      <p className="muted">
        Keep the password safe: it cannot be recovered. Restore procedures and a
        local backup-verification tool are included in the deployment runbook.
        Automatic off-site backups require a company storage destination.
      </p>
    </form>
  );
}
