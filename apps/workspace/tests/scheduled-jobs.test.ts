import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { scheduledJobs, scheduledBackup } from "../src/lib/scheduled-jobs";
import { BACKUP_CRON, nextScheduledBackup } from "../src/lib/backup-schedule";
import { authorizedCron } from "../src/lib/cron-auth";
test("weekly backup and daily reminder failures are isolated and never expose provider details", async () => {
  let copied = 0,
    sent = 0;
  const [messages, backup] = await Promise.all([
    scheduledJobs(
      async () => {
        throw new Error("private provider details");
      },
      async () => {
        sent++;
      },
    ),
    scheduledBackup(async () => {
      copied++;
      return { configured: true, primary_created: true };
    }),
  ]);
  assert.equal(copied, 1);
  assert.equal(sent, 0);
  assert.equal(messages.ok, false);
  assert.equal(backup.ok, true);
  assert.ok(!JSON.stringify(messages).includes("private provider details"));
  const [successfulMessages, failedBackup] = await Promise.all([
    scheduledJobs(
      async () => {},
      async () => ({ sent: 2 }),
    ),
    scheduledBackup(async () => {
      throw new Error("private backup details");
    }),
  ]);
  assert.equal(successfulMessages.ok, true);
  assert.equal(failedBackup.ok, false);
  assert.ok(!JSON.stringify(failedBackup).includes("private backup details"));
  assert.equal(
    (await scheduledBackup(async () => ({ configured: false }))).ok,
    false,
  );
});
test("weekly backups use a separate seven-day cron without slowing daily reminders", async () => {
  const config = JSON.parse(await readFile("vercel.json", "utf8"));
  assert.deepEqual(config.crons, [
    { path: "/api/jobs", schedule: "0 7 * * *" },
    { path: "/api/jobs/backup", schedule: BACKUP_CRON },
  ]);
  assert.equal(BACKUP_CRON, "0 7 * * 1");
  assert.equal(
    nextScheduledBackup(new Date("2026-11-02T06:59:59Z")),
    "2026-11-02T07:00:00.000Z",
  );
  assert.equal(
    nextScheduledBackup(new Date("2026-11-02T07:00:00Z")),
    "2026-11-09T07:00:00.000Z",
  );
  assert.equal(
    nextScheduledBackup(new Date("2026-12-28T07:00:00Z")),
    "2027-01-04T07:00:00.000Z",
  );
  const first = nextScheduledBackup(new Date("2028-02-28T07:00:00Z"));
  const next = nextScheduledBackup(new Date(first));
  assert.equal(
    new Date(next).getTime() - new Date(first).getTime(),
    7 * 24 * 60 * 60 * 1000,
  );
});
test("both cron handlers require the exact secret and reject missing or malformed authorization", () => {
  const secret = "SYNTHETIC-CRON-FIXTURE";
  const request = (header?: string) =>
    new Request("https://example.invalid/api/jobs/backup", {
      headers: header ? { authorization: header } : {},
    });
  assert.equal(authorizedCron(request(), secret), false);
  assert.equal(authorizedCron(request("Bearer wrong"), secret), false);
  assert.equal(authorizedCron(request("Bearer " + secret), ""), false);
  assert.equal(authorizedCron(request("Bearer " + secret), secret), true);
});
