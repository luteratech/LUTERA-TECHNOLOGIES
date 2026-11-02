"use client";
import {
  appNotice,
  dismissNotice,
  feedbackText,
  clearNotices,
} from "./notifications";
export class ApiError extends Error {
  notified = false;
  constructor(
    message: string,
    public status = 0,
    public retryAfter = 0,
  ) {
    super(message);
  }
}
async function requestAPI<T = unknown>(
  action: string,
  body?: unknown,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api/${action}`, {
      method: body === undefined ? "GET" : "POST",
      headers: body === undefined ? {} : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
    });
  } catch {
    throw new ApiError(
      "We could not connect. Check your connection and try again.",
    );
  }
  let result;
  try {
    result = await response.json();
  } catch {
    throw new ApiError(
      "The server returned an unexpected response. Please retry.",
      response.status,
    );
  }
  if (!response.ok)
    throw new ApiError(
      typeof result?.error === "string"
        ? result.error
        : "The request could not be completed.",
      response.status,
      Number(response.headers.get("Retry-After")) || 0,
    );
  return result;
}
async function downloadFile(action: string, body: unknown) {
  let response: Response;
  try {
    response = await fetch(`/api/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new ApiError(
      "We could not connect. Check your connection and try again.",
    );
  }
  if (!response.ok) {
    const value = await response
      .json()
      .catch(() => ({ error: "Export failed. Please retry." }));
    throw new ApiError(value.error || "Export failed.", response.status);
  }
  const blob = await response.blob(),
    url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download =
    response.headers
      .get("content-disposition")
      ?.match(/filename="([^"]+)"/)?.[1] || "lutera-export";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function api<T = unknown>(
  action: string,
  body?: unknown,
  options: { notifications?: boolean } = {},
): Promise<T> {
  const id = crypto.randomUUID();
  const enabled = options.notifications !== false && action !== "session";
  const timer =
    enabled && body !== undefined && action !== "records"
      ? setTimeout(
          () =>
            appNotice(
              "Your request is still processing. The result will appear here.",
              "loading",
              { id },
            ),
          800,
        )
      : undefined;
  try {
    const result = await requestAPI<T>(action, body);
    if (action === "auth/signout" || action === "portal/signout")
      clearNotices();
    return result;
  } catch (error) {
    if (enabled) {
      appNotice(feedbackText(error), "error");
      if (error instanceof ApiError) error.notified = true;
    }
    throw error;
  } finally {
    if (timer) clearTimeout(timer);
    dismissNotice(id);
  }
}
export async function saveFile(action: string, body: unknown) {
  const id = crypto.randomUUID();
  const timer = setTimeout(
    () =>
      appNotice("Preparing your file for download…", "loading", {
        id,
        title: "Preparing download",
      }),
    500,
  );
  try {
    await downloadFile(action, body);
    appNotice(
      "Your file is ready. Your browser will handle saving it.",
      "success",
      { title: "Download ready" },
    );
  } catch (error) {
    appNotice(feedbackText(error), "error");
    if (error instanceof ApiError) error.notified = true;
    throw error;
  } finally {
    clearTimeout(timer);
    dismissNotice(id);
  }
}
