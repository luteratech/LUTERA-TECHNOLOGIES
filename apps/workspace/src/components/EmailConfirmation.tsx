"use client";
import PasswordInput from "./PasswordInput";
import { api } from "@/lib/client";
import { useCooldown } from "@/lib/cooldown";
import { passwordIssues } from "@/lib/password";
import { useEffect, useState } from "react";
import type { emailActionTypes } from "@/lib/auth-email";
type Action = (typeof emailActionTypes)[number];
export default function EmailConfirmation({
  token,
  type,
}: {
  token: string;
  type: Action | null;
}) {
  const cooldown = useCooldown();
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const [completed, setCompleted] = useState(false);
  useEffect(() => {
    // Remove the token from the visible address/history after hydration. It is
    // held only in this page's memory until the user explicitly continues.
    window.history.replaceState(null, "", "/auth/confirm");
  }, []);
  const invite = type === "invite",
    recovery = type === "recovery";
  const valid = Boolean(token && type);
  return (
    <main className="auth-shell">
      <section className="auth-brand">
        <a href="https://luteratech.com">
          <img
            src="/brand/lutera-horizontal-dark.svg"
            alt="Lutera Technology Ltd"
            width="170"
            height="49"
          />
        </a>
        <div>
          <p className="eyebrow">Lutera Technology Ltd</p>
          <h1>
            Your work.
            <br />
            Connected.
          </h1>
          <p>Secure access for the people behind Lutera.</p>
        </div>
        <span>Supply. Build. Connect.</span>
      </section>
      <section className="auth-form">
        <p className="eyebrow">Private business workspace</p>
        <h2>
          {!valid
            ? "Check your email link."
            : invite
              ? "Welcome to Lutera."
              : recovery
                ? "Recover your account."
                : "Confirm your email."}
        </h2>
        {!valid ? (
          <p>
            Open the full link from your latest Lutera account email. If it has
            expired, contact the company owner for a new one.
          </p>
        ) : completed ? (
          <p role="status">{message}</p>
        ) : (
          <>
            <p>
              {invite
                ? "Choose a unique password to accept your invitation. You will then set up your authenticator."
                : recovery
                  ? "Continue to verify your existing authenticator, then choose a new password in My account. Email recovery does not remove your authenticator."
                  : "Continue to confirm this account action. Only approved accounts can open the workspace."}
            </p>
            {cooldown.seconds > 0 && (
              <p role="status">Try again in {cooldown.seconds} seconds.</p>
            )}
            <form
              onSubmit={async (event) => {
                event.preventDefault();
                const form = event.currentTarget,
                  values = new FormData(form);
                if (
                  invite &&
                  values.get("password") !== values.get("confirmation")
                ) {
                  setMessage("Passwords must match.");
                  return;
                }
                if (
                  invite &&
                  passwordIssues(String(values.get("password") || "")).length
                ) {
                  setMessage(
                    "Follow all password requirements before continuing.",
                  );
                  return;
                }
                setBusy(true);
                setMessage("");
                try {
                  const data = await api<{ next: string; redirect?: string }>(
                    "auth/email-confirm",
                    {
                      token_hash: token,
                      type,
                      ...(invite
                        ? {
                            password: values.get("password"),
                            confirmation: values.get("confirmation"),
                          }
                        : {}),
                    },
                  );
                  form.reset();
                  if (data.next === "email_pending") {
                    setCompleted(true);
                    setMessage(
                      "This email is confirmed. Complete the confirmation in your other mailbox to finish the email change.",
                    );
                    return;
                  }
                  if (
                    typeof data.redirect !== "string" ||
                    !/^\/[A-Za-z0-9_-]{32,128}(\?account=password)?$/.test(
                      data.redirect,
                    )
                  )
                    throw new Error(
                      "Return address is unavailable. Contact the company owner.",
                    );
                  window.location.replace(data.redirect);
                } catch (error) {
                  cooldown.handle(error);
                  setMessage((error as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {invite && (
                <>
                  <PasswordInput
                    label="New password"
                    name="password"
                    minLength={12}
                    maxLength={128}
                    autoComplete="new-password"
                    required
                    requirements
                  />
                  <PasswordInput
                    label="Confirm password"
                    name="confirmation"
                    minLength={12}
                    maxLength={128}
                    autoComplete="new-password"
                    required
                  />
                </>
              )}
              {message && (
                <p className="error" role="alert">
                  {message}
                </p>
              )}
              <button disabled={busy || cooldown.seconds > 0}>
                {busy
                  ? "Confirming…"
                  : invite
                    ? "Accept invitation"
                    : recovery
                      ? "Continue recovery"
                      : "Confirm and continue"}
              </button>
            </form>
          </>
        )}
        <p className="muted">
          Need help? <a href="mailto:support@luteratech.com">Contact Lutera</a>{" "}
          or visit <a href="https://luteratech.com">luteratech.com</a>.
        </p>
      </section>
    </main>
  );
}
