"use client";
import { useFeedback, appNotice } from "@/lib/notifications";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Session } from "./Workspace";
import { api } from "@/lib/client";
import { useCooldown } from "@/lib/cooldown";
import { useUnsavedChanges } from "@/lib/unsaved";
import {
  profileSchema,
  emailChangeSchema,
  type AccountInfo,
} from "@/lib/account-contracts";
import { passwordIssues } from "@/lib/password";
import PasswordInput from "./PasswordInput";
export default function Account({ session }: { session: Session }) {
  const [info, setInfo] = useState<AccountInfo | null>(null),
    [loadError, setLoadError] = useFeedback("error");
  const [name, setName] = useState(""),
    [phone, setPhone] = useState(""),
    [photo, setPhoto] = useState(""),
    [preview, setPreview] = useState(""),
    [removePhoto, setRemovePhoto] = useState(false);
  const [email, setEmail] = useState(""),
    [emailConfirm, setEmailConfirm] = useState("");
  const [password, setPassword] = useState(""),
    [confirmation, setConfirmation] = useState("");
  const [enrollment, setEnrollment] = useState<{
      id: string;
      qr: string;
      secret: string;
    } | null>(null),
    [factorName, setFactorName] = useState("Work phone"),
    [code, setCode] = useState("");
  const [busy, setBusy] = useState("");
  const cooldown = useCooldown();
  const dirty = Boolean(
    (info &&
      (name !== info.profile.full_name ||
        phone !== info.profile.phone ||
        photo ||
        removePhoto)) ||
      email ||
      emailConfirm ||
      password ||
      confirmation ||
      enrollment,
  );
  const allowNavigation = useUnsavedChanges(dirty);
  const reload = useCallback(async () => {
    const next = await api<AccountInfo>("account");
    setInfo(next);
    setName(next.profile.full_name);
    setPhone(next.profile.phone);
    setPhoto("");
    setPreview("");
    setRemovePhoto(false);
    setLoadError("");
  }, []);
  useEffect(() => {
    void reload().catch((e) => setLoadError(e as Error));
  }, [reload]);
  function notify(text: string, kind: "success" | "error") {
    appNotice(text, kind);
  }
  function failed(error: unknown) {
    cooldown.handle(error);
    notify((error as Error).message, "error");
  }
  if (!info)
    return (
      <section className="panel">
        <h2>My account</h2>
        {loadError ? (
          <>
            {null}
            <button
              onClick={() =>
                void reload().catch((e) => setLoadError(e as Error))
              }
            >
              Try again
            </button>
          </>
        ) : (
          <p role="status">Loading your account…</p>
        )}
      </section>
    );
  const locked = Boolean(busy) || cooldown.seconds > 0;
  return (
    <div className="account-settings">
      <nav className="account-anchor-nav" aria-label="Account sections">
        {["Profile", "Email", "Password", "Authenticator"].map((label, i) => (
          <a key={label} href={"#account-section-" + (i + 1)}>
            {label}
          </a>
        ))}
      </nav>
      <section className="account-intro">
        <h2 className="sr-only">Account settings</h2>
        <p>Manage your profile and keep your account protected.</p>
        <span className="security-badge">
          Authenticator protected · {session.role}
        </span>
      </section>
      {cooldown.seconds > 0 && (
        <p className="notice" role="status">
          Security requests are paused. Try again in {cooldown.seconds} seconds.
        </p>
      )}
      <section className="panel" id="account-section-1">
        <div className="account-section-heading">
          <span className="account-step">01</span>
          <div>
            <h3>Personal profile</h3>
            <p>Your details are private to your account.</p>
          </div>
        </div>
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            const payload = {
              version: info.profile.version,
              full_name: name,
              phone,
              ...(photo ? { photo } : {}),
              remove_photo: removePhoto,
            };
            const valid = profileSchema.safeParse(payload);
            if (!valid.success) {
              notify(valid.error.issues[0].message, "error");
              return;
            }
            setBusy("profile");
            try {
              await api("account/profile", valid.data);
              await reload();
              notify("Your profile has been updated.", "success");
            } catch (e) {
              failed(e);
            } finally {
              setBusy("");
            }
          }}
        >
          <div className="profile-photo-editor">
            <div className="profile-avatar">
              {preview || (!removePhoto && info.profile.avatar_url) ? (
                <img
                  src={preview || info.profile.avatar_url!}
                  alt="Your profile photo"
                  width="88"
                  height="88"
                />
              ) : (
                <span aria-label="Profile initials">
                  {(name.trim() || session.email)
                    .split(/\s+/)
                    .slice(0, 2)
                    .map((v) => v[0])
                    .join("")
                    .toUpperCase()}
                </span>
              )}
            </div>
            <div>
              <label className="photo-upload">
                <span>Upload profile photo</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  disabled={Boolean(busy)}
                  onChange={async (event) => {
                    const input = event.currentTarget,
                      file = input.files?.[0];
                    if (!file) return;
                    if (
                      file.size > 1048576 ||
                      !["image/jpeg", "image/png", "image/webp"].includes(
                        file.type,
                      )
                    ) {
                      notify(
                        "Choose a JPEG, PNG or WebP photo under 1 MB.",
                        "error",
                      );
                      input.value = "";
                      return;
                    }
                    try {
                      const data = await new Promise<string>(
                        (resolve, reject) => {
                          const reader = new FileReader();
                          reader.onload = () => resolve(String(reader.result));
                          reader.onerror = () =>
                            reject(
                              new Error(
                                "The photo could not be read. Please choose it again.",
                              ),
                            );
                          reader.readAsDataURL(file);
                        },
                      );
                      setPhoto(data.split(",")[1]);
                      setPreview(data);
                      setRemovePhoto(false);
                    } catch (e) {
                      failed(e);
                    }
                  }}
                />
              </label>
              <p className="muted">JPEG, PNG or WebP · up to 1 MB</p>
              {(photo || info.profile.avatar_url) && !removePhoto && (
                <button
                  type="button"
                  className="text-button"
                  onClick={() => {
                    setPhoto("");
                    setPreview("");
                    setRemovePhoto(true);
                  }}
                >
                  Remove photo
                </button>
              )}
            </div>
          </div>
          <div className="form-grid">
            <label className="field">
              <span>Full name</span>
              <input
                name="full_name"
                autoComplete="name"
                required
                maxLength={120}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <label className="field">
              <span>Phone number</span>
              <input
                name="phone"
                type="tel"
                autoComplete="tel"
                maxLength={40}
                placeholder="+234 …"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </label>
          </div>
          <button disabled={Boolean(busy)}>
            {busy === "profile" ? "Saving profile…" : "Save profile"}
          </button>
        </form>
      </section>
      <section className="panel" id="account-section-2">
        <div className="account-section-heading">
          <span className="account-step">02</span>
          <div>
            <h3>Email address</h3>
            <p>
              Current address: <strong>{info.email}</strong>
            </p>
          </div>
        </div>
        {info.pending_email && (
          <p className="notice" role="status">
            Waiting for confirmation: <strong>{info.pending_email}</strong>.
            Check both inboxes. Your current address remains active until the
            change is confirmed.
          </p>
        )}
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            const valid = emailChangeSchema.safeParse({
              email,
              confirmation: emailConfirm,
            });
            if (!valid.success) {
              notify(valid.error.issues[0].message, "error");
              return;
            }
            setBusy("email");
            try {
              const result = await api<{ message: string }>(
                "account/email",
                valid.data,
              );
              setEmail("");
              setEmailConfirm("");
              await reload();
              notify(result.message, "success");
            } catch (e) {
              failed(e);
            } finally {
              setBusy("");
            }
          }}
        >
          <div className="form-grid">
            <label className="field">
              <span>New email address</span>
              <input
                name="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                maxLength={254}
                required
              />
            </label>
            <label className="field">
              <span>Confirm new email address</span>
              <input
                name="email_confirmation"
                type="email"
                autoComplete="off"
                value={emailConfirm}
                onChange={(e) => setEmailConfirm(e.target.value)}
                maxLength={254}
                required
              />
            </label>
          </div>
          <p className="muted">
            We will ask you to confirm the change through email. Your workspace
            role stays the same.
          </p>
          <button disabled={locked}>
            {busy === "email"
              ? "Requesting confirmation…"
              : "Request email change"}
          </button>
        </form>
      </section>
      <section className="panel" id="account-section-3">
        <div className="account-section-heading">
          <span className="account-step">03</span>
          <div>
            <h3>Password</h3>
            <p>
              Use a unique password. A successful change signs you out on every
              device.
            </p>
          </div>
        </div>
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            if (password !== confirmation) {
              notify("Passwords must match.", "error");
              return;
            }
            const missing = passwordIssues(password);
            if (missing.length) {
              notify("Password requires: " + missing.join(", ") + ".", "error");
              return;
            }
            setBusy("password");
            try {
              await api("auth/password", { password });
              setPassword("");
              setConfirmation("");
              allowNavigation();
              window.location.assign(
                window.location.pathname + "?notice=password-changed",
              );
            } catch (e) {
              failed(e);
            } finally {
              setBusy("");
            }
          }}
        >
          <div className="form-grid">
            <PasswordInput
              label="New password"
              name="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              minLength={12}
              maxLength={128}
              required
              requirements
            />
            <PasswordInput
              label="Confirm new password"
              name="confirmation"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              autoComplete="new-password"
              minLength={12}
              maxLength={128}
              required
            />
          </div>
          <button disabled={locked}>
            {busy === "password"
              ? "Updating password…"
              : "Change password & sign out"}
          </button>
        </form>
      </section>
      <section className="panel" id="account-section-4">
        <div className="account-section-heading">
          <span className="account-step">04</span>
          <div>
            <h3>Multi-factor authentication</h3>
            <p>
              <strong className="mfa-enabled">
                Enabled · required for workspace access
              </strong>
            </p>
          </div>
        </div>
        <p>
          Your authenticator protects your account even if someone knows your
          password.
        </p>
        <ul className="factor-list">
          {info.factors.map((factor) => (
            <li key={factor.id}>
              <span>{factor.name}</span>
              <span className="security-badge">Verified</span>
            </li>
          ))}
        </ul>
        {!enrollment && info.factors.length < 3 && (
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              setBusy("mfa-add");
              try {
                setEnrollment(await api("mfa/add", { name: factorName }));
                notify(
                  "Scan the QR code with your additional authenticator, then confirm its code.",
                  "success",
                );
              } catch (e) {
                failed(e);
              } finally {
                setBusy("");
              }
            }}
          >
            <label className="field">
              <span>New authenticator name</span>
              <input
                name="factor_name"
                value={factorName}
                onChange={(e) => setFactorName(e.target.value)}
                minLength={1}
                maxLength={60}
                required
              />
            </label>
            <button className="secondary" disabled={locked}>
              {busy === "mfa-add" ? "Preparing…" : "Add an authenticator"}
            </button>
          </form>
        )}
        {enrollment && (
          <div className="account-enrollment">
            <img
              className="qr"
              width="200"
              height="200"
              alt="Scan with your new authenticator app"
              src={
                enrollment.qr.startsWith("data:")
                  ? enrollment.qr
                  : `data:image/svg+xml;charset=utf-8,${encodeURIComponent(enrollment.qr)}`
              }
            />
            <details>
              <summary>Enter the setup key manually</summary>
              <code className="secret">{enrollment.secret}</code>
            </details>
            <form
              onSubmit={async (event) => {
                event.preventDefault();
                setBusy("mfa-confirm");
                try {
                  await api("mfa/confirm-add", {
                    factorId: enrollment.id,
                    code,
                  });
                  setEnrollment(null);
                  setCode("");
                  await reload();
                  notify(
                    "Your additional authenticator is enabled and verified.",
                    "success",
                  );
                } catch (e) {
                  failed(e);
                } finally {
                  setBusy("");
                }
              }}
            >
              <label className="field">
                <span>New authenticator code</span>
                <input
                  name="code"
                  autoComplete="one-time-code"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  required
                />
              </label>
              <button disabled={locked}>
                {busy === "mfa-confirm"
                  ? "Verifying…"
                  : "Verify new authenticator"}
              </button>
            </form>
          </div>
        )}
        <p className="muted">
          MFA cannot be switched off from the workspace. Keep a backup
          authenticator and contact the company owner if a device is lost.
        </p>
      </section>
    </div>
  );
}
