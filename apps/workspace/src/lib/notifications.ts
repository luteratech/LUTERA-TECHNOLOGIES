"use client";
import { useCallback, useRef, useState } from "react";
export type NoticeTone = "success" | "error" | "info" | "loading";
export type AppNotice = {
  id: string;
  message: string;
  title: string;
  tone: NoticeTone;
  time: number;
  visible: boolean;
  read: boolean;
};
export const notificationEvent = "lutera-notification";
export const confirmationEvent = "lutera-confirmation";
export type ConfirmRequest = {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  input?: {
    label: string;
    minLength: number;
    maxLength: number;
    onValue: (value: string) => void;
  };
  resolve: (value: boolean) => void;
};
export type NoticeEvent =
  | { type: "show"; notice: AppNotice }
  | { type: "dismiss"; id: string }
  | { type: "read" }
  | { type: "clear" };
export function noticeReducer(
  state: AppNotice[],
  event: NoticeEvent,
): AppNotice[] {
  if (event.type === "clear") return [];
  if (event.type === "read") return state.map((n) => ({ ...n, read: true }));
  if (event.type === "dismiss")
    return state.flatMap((n) =>
      n.id === event.id
        ? n.tone === "loading"
          ? []
          : [{ ...n, visible: false, read: true }]
        : [n],
    );
  const next = event.notice;
  const prior = state.find(
    (n) =>
      n.id === next.id ||
      (n.message === next.message && next.time - n.time < 3000),
  );
  if (prior) {
    const tone =
      prior.tone === "error" && next.tone !== "loading" ? "error" : next.tone;
    return [
      { ...next, id: next.id, tone },
      ...state.filter((n) => n.id !== prior.id),
    ].slice(0, 20);
  }
  return [next, ...state].slice(0, 20);
}
export function appNotice(
  message: string,
  tone: NoticeTone = "info",
  options: { id?: string; title?: string } = {},
) {
  const id = options.id || crypto.randomUUID();
  if (typeof window !== "undefined")
    window.dispatchEvent(
      new CustomEvent<NoticeEvent>(notificationEvent, {
        detail: {
          type: "show",
          notice: {
            id,
            message,
            title:
              options.title ||
              {
                success: "Completed",
                error: "Action needs attention",
                info: "Workspace update",
                loading: "Working on your request",
              }[tone],
            tone,
            time: Date.now(),
            visible: true,
            read: false,
          },
        },
      }),
    );
  return id;
}
export function dismissNotice(id: string) {
  if (typeof window !== "undefined")
    window.dispatchEvent(
      new CustomEvent<NoticeEvent>(notificationEvent, {
        detail: { type: "dismiss", id },
      }),
    );
}
export function clearNotices() {
  if (typeof window !== "undefined")
    window.dispatchEvent(
      new CustomEvent<NoticeEvent>(notificationEvent, {
        detail: { type: "clear" },
      }),
    );
}
export function feedbackText(value: unknown): string {
  if (
    value &&
    typeof value === "object" &&
    "issues" in value &&
    Array.isArray(value.issues)
  )
    return String(
      value.issues[0]?.message ||
        "Check the highlighted information and retry.",
    );
  return value instanceof Error ? value.message : String(value || "");
}
/** Notify immediately, including repeated errors and results after a tool closes. */
export function useFeedback(tone: NoticeTone = "success") {
  const [value, setValue] = useState("");
  const current = useRef(""),
    last = useRef("");
  const update = useCallback(
    (next: string | Error | ((previous: string) => string)) => {
      const text = feedbackText(
        typeof next === "function" ? next(current.current) : next,
      );
      current.current = text;
      setValue(text);
      if (text)
        last.current = appNotice(text, next instanceof Error ? "error" : tone);
      else if (last.current) dismissNotice(last.current);
    },
    [tone],
  );
  return [value, update] as const;
}
export function confirmAction(
  request: Omit<ConfirmRequest, "resolve">,
): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  return new Promise((resolve) =>
    window.dispatchEvent(
      new CustomEvent<ConfirmRequest>(confirmationEvent, {
        detail: { ...request, resolve },
      }),
    ),
  );
}

export async function requestReason(options: {
  title: string;
  message: string;
  confirmLabel: string;
}) {
  let reason = "";
  const confirmed = await confirmAction({
    ...options,
    danger: true,
    input: {
      label: "Reason",
      minLength: 5,
      maxLength: 500,
      onValue: (value) => {
        reason = value;
      },
    },
  });
  return confirmed ? reason : null;
}
