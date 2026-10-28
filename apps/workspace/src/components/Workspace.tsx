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
import WorkspaceAreas from "./WorkspaceAreas";
const BusinessAccess = dynamic(() => import("./BusinessAccess"), {
  loading: () => <p role="status">Opening permissions…</p>,
});
import {
  departments,
  workspaceSections,
  visibleTools,
  toolAt,
  departmentFor,
  type Destination,
} from "@/lib/workspace-areas";
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
import BusinessWorkspace, {
  BusinessDashboard,
  type BusinessConfig,
} from "./BusinessWorkspace";
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
    [accessConfig, setAccessConfig] = useState<BusinessConfig | null>(null),
    [routeSearch, setRouteSearch] = useState(""),
    [documentId, setDocumentId] = useState<string | undefined>(undefined),
    [navigationVersion, setNavigationVersion] = useState(0),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const activeSession = useRef<Session | null>(null);
  const refresh = useCallback(async () => {
    await Promise.all([
      api<State>("state").then(setData),
      api<BusinessConfig>("business/config")
        .then((c) => setAccessConfig(c.access ? c : null))
        .catch(() => setAccessConfig(null)),
    ]);
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
            : workspaceSections.includes(
                  new URLSearchParams(window.location.search).get("section") ||
                    "",
                )
              ? new URLSearchParams(window.location.search).get("section")!
              : "overview",
        );
        setRouteSearch(location.search);
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
    setTab(workspaceSections.includes(area) ? area : "overview");
    setRouteSearch(location.search);
    if (pop) {
      setDocumentId(params.get("document") || undefined);
      setNavigationVersion((v) => v + 1);
      setError("");
      requestAnimationFrame(() =>
        document.getElementById("workspace-main")?.focus(),
      );
    }
  });
  const openDestination = (target: Destination) => {
    if (!mayLeave()) return false;
    workspaceLocation({
      section: target.section,
      module: null,
      kind: null,
      record: null,
      control: null,
      document: null,
      documentKind: null,
      editor: null,
      tool: null,
      account: null,
      notice: null,
      ...target.params,
    });
    if (target.section === tab) setNavigationVersion((v) => v + 1);
    setTab(target.section);
    setRouteSearch(location.search);
    setDocumentId(target.params?.document);
    setError("");
    requestAnimationFrame(() =>
      document.getElementById("workspace-main")?.focus(),
    );
    return true;
  };
  const goToSection = (area: string, id?: string) =>
    openDestination({ section: area, params: id ? { document: id } : {} });
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
  const tools = session ? visibleTools(session.role, accessConfig) : [];
  const params = new URLSearchParams(routeSearch);
  const currentTool = toolAt(tab, params, tools);
  const departmentId = departmentFor(tab, params);
  const department = departments.find((d) => d.id === departmentId);
  const isDepartment = departments.some((d) => d.id === tab);
  const requiredCapability = (
    {
      finance: "finance",
      staff: "staff",
      content: "content",
      settings: "settings",
      members: "members",
      "business-access": "members",
      "business-settings": "members",
      audit: "audit",
      backup: "backup",
      reports: "finance",
    } as Record<string, string>
  )[tab];
  const legacyLabels: Record<string, string> = {
    overview: "Dashboard",
    account: "My account",
    operations: "Business tools",
    controls: "Additional tools",
    finance: "Document archive",
    content: "Website editor",
    reports: "Financial reports",
    staff: "Staff profiles & cards",
    settings: "Company document settings",
    "business-settings": "Operations settings",
    members: "User access",
    audit: "Activity history",
    backup: "Backups & recovery",
  };
  const title =
    departments.find((d) => d.id === tab)?.label ||
    currentTool?.label ||
    legacyLabels[tab] ||
    "Workspace";
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
      tools={tools}
      active={tab}
      activeDepartment={departmentId}
      activeTool={currentTool?.id}
      onNavigate={openDestination}
      email={session.email}
      role={session.role}
      busy={busy}
      onSignout={signout}
    >
      <main id="workspace-main" tabIndex={-1}>
        <div
          className="workspace-history"
          role="group"
          aria-label="Page history"
        >
          <button
            className="secondary"
            type="button"
            aria-label="Go back"
            title="Go back"
            disabled={!navigation.back}
            onClick={() => navigation.go(-1)}
          >
            <svg
              viewBox="0 0 24 24"
              width="18"
              height="18"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              aria-hidden="true"
            >
              <path d="M19 12H5m6-6-6 6 6 6" />
            </svg>
          </button>
          <button
            className="secondary"
            type="button"
            aria-label="Go forward"
            title="Go forward"
            disabled={!navigation.forward}
            onClick={() => navigation.go(1)}
          >
            <svg
              viewBox="0 0 24 24"
              width="18"
              height="18"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              aria-hidden="true"
            >
              <path d="M5 12h14m-6-6 6 6-6 6" />
            </svg>
          </button>
        </div>

        <nav className="workspace-breadcrumb" aria-label="Breadcrumb">
          <button
            type="button"
            onClick={() => goToSection("overview")}
            disabled={tab === "overview"}
          >
            Workspace
          </button>
          {department && !isDepartment && (
            <>
              <span aria-hidden="true">/</span>
              <button
                type="button"
                onClick={() => openDestination({ section: department.id })}
              >
                {department.label}
              </button>
            </>
          )}
          <span aria-hidden="true">/</span>
          <span aria-current="page">{title}</span>
        </nav>
        <div className="page-heading">
          <div>
            <p className="eyebrow">Lutera Technology Ltd</p>
            <h1>{title}</h1>
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
        ) : requiredCapability && !can(session.role, requiredCapability) ? (
          <Notice>
            Your account does not have access to this tool. Choose a tool from
            your workspace menu.
          </Notice>
        ) : (
          <div key={navigationVersion} className="workspace-page">
            {isDepartment && (
              <WorkspaceAreas
                area={tab}
                tools={tools}
                config={accessConfig}
                open={openDestination}
                website={
                  data.content
                    ? {
                        version: data.content.version,
                        connected: data.publishing_connected,
                        status: data.publications[0]?.status,
                      }
                    : undefined
                }
              />
            )}
            {currentTool && !isDepartment && tab !== "content" && (
              <div className="tool-context">
                <p>{currentTool.description}</p>
                {currentTool.guide && (
                  <details>
                    <summary>How this task works</summary>
                    <ol>
                      {currentTool.guide.map((step) => (
                        <li key={step}>{step}</li>
                      ))}
                    </ol>
                  </details>
                )}
              </div>
            )}
            {tab === "operations" && (
              <BusinessWorkspace
                department={departmentId}
                onOpenDocument={(id) => goToSection("finance", id)}
              />
            )}
            {tab === "overview" && (
              <>
                <WorkspaceAreas
                  area="overview"
                  tools={tools}
                  config={accessConfig}
                  open={openDestination}
                />
                {accessConfig &&
                  Object.values(accessConfig.access).some((a) => a.read) && (
                    <BusinessDashboard
                      onOpen={
                        tools.some((t) => t.department === "sales")
                          ? () => openDestination({ section: "sales" })
                          : undefined
                      }
                    />
                  )}
              </>
            )}
            {tab === "finance" && (
              <Documents
                focusKind={
                  ["quotation", "proforma", "receipt"].includes(
                    params.get("documentKind") || "",
                  )
                    ? (params.get("documentKind") as
                        | "quotation"
                        | "proforma"
                        | "receipt")
                    : undefined
                }
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
            {tab === "business-access" && (
              <BusinessAccess config={accessConfig} />
            )}
            {tab === "members" && (
              <Members records={data.members} refresh={refresh} />
            )}
            {tab === "controls" && <OperationsDesk department={departmentId} />}
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
