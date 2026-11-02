import { test } from "node:test";
import assert from "node:assert/strict";
import {
  noticeReducer,
  feedbackText,
  type AppNotice,
} from "../src/lib/notifications";
import { backupFeedback } from "../src/lib/backup-feedback";
const notice = (
  id: string,
  message: string,
  tone: AppNotice["tone"] = "success",
  time = 1,
): AppNotice => ({
  id,
  message,
  tone,
  time,
  title: "Fixture",
  visible: true,
  read: false,
});
test("notification state deduplicates repeated feedback, preserves errors and keeps bounded history", () => {
  let state = noticeReducer([], {
    type: "show",
    notice: notice("a", "Denied", "error"),
  });
  state = noticeReducer(state, {
    type: "show",
    notice: notice("b", "Denied", "success", 2),
  });
  assert.equal(state.length, 1);
  assert.equal(state[0].tone, "error");
  assert.equal(state[0].id, "b");
  state = noticeReducer(state, { type: "dismiss", id: "b" });
  assert.equal(state[0].visible, false);
  state = noticeReducer(state, {
    type: "show",
    notice: notice("c", "Denied", "error", 3005),
  });
  assert.equal(state[0].visible, true);
  for (let i = 0; i < 30; i++)
    state = noticeReducer(state, {
      type: "show",
      notice: notice(String(i), `Message ${i}`, "info", 5000 + i),
    });
  assert.equal(state.length, 20);
  assert.ok(noticeReducer(state, { type: "read" }).every((n) => n.read));
  assert.deepEqual(noticeReducer(state, { type: "clear" }), []);
  assert.equal(
    feedbackText(
      Object.assign(new Error("Internal JSON"), {
        issues: [{ message: "Check the quantity" }],
      }),
    ),
    "Check the quantity",
  );
});
test("backup feedback distinguishes successful primary storage, pending Drive, reuse, active runs and unconfigured backups", () => {
  const latest = {
    id: "fixture",
    day: "2026-11-02",
    status: "primary",
    created_at: "2026-11-02T15:00:00Z",
    bytes: 100,
    file_count: 0,
  };
  let r = backupFeedback(
    { configured: true, primary_created: true, offsite_pending: 1, latest },
    "2026-11-02",
  );
  assert.equal(r.tone, "success");
  assert.match(r.message, /Drive copy is still pending/);
  r = backupFeedback(
    {
      configured: true,
      primary_created: false,
      latest: { ...latest, status: "complete" },
    },
    "2026-11-02",
  );
  assert.match(r.title, /already exists/);
  assert.match(r.message, /recorded receipt/);
  r = backupFeedback(
    {
      configured: true,
      primary_created: false,
      latest: { ...latest, status: "running" },
    },
    "2026-11-02",
  );
  assert.equal(r.tone, "info");
  assert.match(r.title, /running/);
  assert.equal(backupFeedback({ configured: false }).tone, "error");
  r = backupFeedback(
    {
      configured: true,
      primary_created: false,
      latest: { ...latest, day: "2026-10-23" },
    },
    "2026-11-02",
  );
  assert.equal(r.tone, "info");
  assert.doesNotMatch(r.title, /saved|exists/);
});

test("completed request spinners do not remain as pending items in notification history", () => {
  const state = noticeReducer([], {
    type: "show",
    notice: notice("pending", "Working", "loading"),
  });
  assert.deepEqual(
    noticeReducer(state, { type: "dismiss", id: "pending" }),
    [],
  );
});
