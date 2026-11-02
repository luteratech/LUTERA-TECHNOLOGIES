"use client";
import { useEffect, useReducer, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  notificationEvent,
  confirmationEvent,
  appNotice,
  noticeReducer,
  type NoticeEvent,
  type AppNotice,
  type ConfirmRequest,
} from "@/lib/notifications";
function NoticeCard({
  notice,
  dismiss,
}: {
  notice: AppNotice;
  dismiss: () => void;
}) {
  const remaining = useRef(8000),
    started = useRef(0),
    timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pause = () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = undefined;
      remaining.current -= Date.now() - started.current;
    }
  };
  const resume = () => {
    if (
      notice.tone !== "error" &&
      notice.tone !== "loading" &&
      !timer.current
    ) {
      started.current = Date.now();
      timer.current = setTimeout(dismiss, Math.max(0, remaining.current));
    }
  };
  useEffect(() => {
    remaining.current = 8000;
    if (!document.hidden) resume();
    const visibility = () => {
      if (document.hidden) pause();
      else resume();
    };
    document.addEventListener("visibilitychange", visibility);
    return () => {
      pause();
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [notice.time, notice.tone]);
  return (
    <article
      className="app-toast"
      data-tone={notice.tone}
      onMouseEnter={pause}
      onMouseLeave={resume}
      onFocusCapture={pause}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) resume();
      }}
    >
      <span className="app-toast-icon" aria-hidden="true">
        {notice.tone === "loading" ? (
          <span className="app-spinner" />
        ) : notice.tone === "success" ? (
          "✓"
        ) : notice.tone === "error" ? (
          "!"
        ) : (
          "i"
        )}
      </span>
      <div
        role={notice.tone === "error" ? "alert" : "status"}
        aria-atomic="true"
      >
        <strong>{notice.title}</strong>
        <p>{notice.message}</p>
      </div>
      <button
        type="button"
        className="app-notice-close"
        aria-label="Dismiss notification"
        onClick={dismiss}
      >
        ×
      </button>
    </article>
  );
}
export default function NotificationCenter() {
  const [notices, dispatch] = useReducer(noticeReducer, []),
    [historyOpen, setHistoryOpen] = useState(false),
    [confirmation, setConfirmation] = useState<ConfirmRequest | null>(null),
    [host, setHost] = useState<HTMLElement | null>(null),
    [inputValue, setInputValue] = useState("");
  const dialog = useRef<HTMLDialogElement>(null),
    pending = useRef<ConfirmRequest | null>(null),
    trigger = useRef<HTMLElement | null>(null),
    historyOpenRef = useRef(false),
    historyRef = useRef<HTMLElement>(null),
    bell = useRef<HTMLButtonElement>(null);
  historyOpenRef.current = historyOpen;
  const finish = (value: boolean) => {
    if (value && pending.current?.input) {
      const input = pending.current.input;
      if (inputValue.trim().length < input.minLength) {
        appNotice(
          `Enter at least ${input.minLength} characters for the reason.`,
          "error",
          { title: "Reason required" },
        );
        return;
      }
      input.onValue(inputValue.trim());
    }
    const request = pending.current;
    pending.current = null;
    dialog.current?.close();
    setConfirmation(null);
    request?.resolve(value);
    requestAnimationFrame(
      () => trigger.current?.isConnected && trigger.current.focus(),
    );
  };
  useEffect(() => {
    const receive = (e: Event) => {
      const event = (e as CustomEvent<NoticeEvent>).detail;
      dispatch(event);
      if (event.type === "clear") setHistoryOpen(false);
    };
    const ask = (e: Event) => {
      const request = (e as CustomEvent<ConfirmRequest>).detail;
      if (pending.current) {
        request.resolve(false);
        return;
      }
      pending.current = request;
      setInputValue("");
      trigger.current = document.activeElement as HTMLElement;
      setConfirmation(request);
    };
    const target = () => {
      const open = Array.from(
        document.querySelectorAll<HTMLDialogElement>("dialog[open]"),
      );
      setHost(open.at(-1) || document.body);
    };
    let invalidFrame: number | undefined;
    const invalid = (event: Event) => {
      event.preventDefault();
      const field = event.target as HTMLInputElement;
      field.setAttribute("aria-invalid", "true");
      field.dataset.appInvalid = "true";
      if (invalidFrame !== undefined) return;
      const labelElement = field.labels?.[0];
      const label = (
        labelElement?.querySelector("span")?.textContent ||
        labelElement?.textContent ||
        field.getAttribute("aria-label") ||
        "This field"
      )
        .replace(/\s+/g, " ")
        .trim();
      appNotice(
        `${label}: ${field.validationMessage || "Check the value and try again."}`,
        "error",
        { title: "Check the form" },
      );
      invalidFrame = requestAnimationFrame(() => {
        field.focus();
        invalidFrame = undefined;
      });
    };
    const input = (event: Event) => {
      const field = event.target as HTMLInputElement;
      if (field.dataset?.appInvalid && field.validity?.valid) {
        field.removeAttribute("aria-invalid");
        delete field.dataset.appInvalid;
      }
    };
    document.addEventListener("invalid", invalid, true);
    document.addEventListener("input", input, true);
    const observer = new MutationObserver(target);
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["open"],
    });
    target();
    const keyboard = (e: KeyboardEvent) => {
      if (e.key === "F8") {
        e.preventDefault();
        document.querySelector<HTMLButtonElement>(".app-toast button")?.focus();
      }
      if (e.key === "Escape" && historyOpenRef.current) {
        setHistoryOpen(false);
        bell.current?.focus();
      }
    };
    const unhandled = (event: PromiseRejectionEvent) => {
      if (
        event.reason &&
        typeof event.reason === "object" &&
        event.reason.notified
      )
        return;
      appNotice(
        "An unexpected problem interrupted this action. Check the record status before retrying, or reopen this section.",
        "error",
        { id: "workspace-unhandled-error", title: "Action interrupted" },
      );
    };
    window.addEventListener("unhandledrejection", unhandled);
    window.addEventListener(notificationEvent, receive);
    window.addEventListener(confirmationEvent, ask);
    window.addEventListener("keydown", keyboard);
    return () => {
      if (invalidFrame !== undefined) cancelAnimationFrame(invalidFrame);
      document.removeEventListener("invalid", invalid, true);
      document.removeEventListener("input", input, true);
      observer.disconnect();
      window.removeEventListener("unhandledrejection", unhandled);
      window.removeEventListener(notificationEvent, receive);
      window.removeEventListener(confirmationEvent, ask);
      window.removeEventListener("keydown", keyboard);
      pending.current?.resolve(false);
    };
  }, []);
  useEffect(() => {
    if (confirmation && !dialog.current?.open) dialog.current?.showModal();
  }, [confirmation]);
  useEffect(() => {
    if (!historyOpen) return;
    dispatch({ type: "read" });
    historyRef.current?.focus();
    const outside = (e: PointerEvent) => {
      if (
        !historyRef.current?.contains(e.target as Node) &&
        !bell.current?.contains(e.target as Node)
      )
        setHistoryOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [historyOpen]);
  const floating = (
    <>
      <section className="app-toast-stack" aria-label="Workspace notifications">
        {notices
          .filter((n) => n.visible)
          .slice(0, 3)
          .map((n) => (
            <NoticeCard
              key={n.id}
              notice={n}
              dismiss={() => dispatch({ type: "dismiss", id: n.id })}
            />
          ))}
      </section>
      <button
        ref={bell}
        className="app-notification-bell"
        aria-label={`Notifications${notices.some((n) => !n.read) ? `, ${notices.filter((n) => !n.read).length} unread` : ""}`}
        aria-expanded={historyOpen}
        aria-controls="app-notification-history"
        onClick={() => setHistoryOpen((v) => !v)}
      >
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          aria-hidden="true"
        >
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Z" />
          <path d="M10 21h4" />
        </svg>
        {notices.some((n) => !n.read) && (
          <span className="app-notification-count">
            {notices.filter((n) => !n.read).length}
          </span>
        )}
      </button>
      {historyOpen && (
        <section
          ref={historyRef}
          id="app-notification-history"
          className="app-notification-history"
          role="region"
          aria-label="Recent notifications"
          tabIndex={-1}
        >
          <header>
            <h2>Notifications</h2>
            <button
              className="app-notice-close"
              aria-label="Close notifications"
              onClick={() => {
                setHistoryOpen(false);
                bell.current?.focus();
              }}
            >
              ×
            </button>
          </header>
          <p>Recent activity in this tab. Messages clear when you sign out.</p>
          {notices.length ? (
            <ol>
              {notices.map((n) => (
                <li key={n.id} data-tone={n.tone}>
                  <strong>{n.title}</strong>
                  <p>{n.message}</p>
                  <time dateTime={new Date(n.time).toISOString()}>
                    {new Date(n.time).toLocaleTimeString("en-NG", {
                      hour: "2-digit",
                      minute: "2-digit",
                      timeZone: "Africa/Lagos",
                    })}
                  </time>
                </li>
              ))}
            </ol>
          ) : (
            <p>No notifications yet.</p>
          )}
          <button
            className="secondary"
            onClick={() => dispatch({ type: "clear" })}
          >
            Clear notifications
          </button>
        </section>
      )}
    </>
  );
  return (
    <>
      {host && createPortal(floating, host)}
      <dialog
        ref={dialog}
        className="app-confirmation"
        aria-labelledby="app-confirm-title"
        aria-describedby="app-confirm-description"
        onCancel={(e) => {
          e.preventDefault();
          finish(false);
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) finish(false);
        }}
      >
        <h2 id="app-confirm-title">{confirmation?.title}</h2>
        <p id="app-confirm-description">{confirmation?.message}</p>
        {confirmation?.input && (
          <label className="field">
            <span>{confirmation.input.label}</span>
            <textarea
              value={inputValue}
              rows={3}
              maxLength={confirmation.input.maxLength}
              onChange={(e) => setInputValue(e.target.value)}
            />
          </label>
        )}
        <div className="actions">
          <button className="secondary" autoFocus onClick={() => finish(false)}>
            {confirmation?.cancelLabel || "Cancel"}
          </button>
          <button
            className={confirmation?.danger ? "danger" : ""}
            onClick={() => finish(true)}
          >
            {confirmation?.confirmLabel || "Confirm"}
          </button>
        </div>
      </dialog>
    </>
  );
}
