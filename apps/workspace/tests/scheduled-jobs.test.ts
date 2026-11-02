import { test } from "node:test";
import assert from "node:assert/strict";
import { scheduledJobs } from "../src/lib/scheduled-jobs";

test("backup runs even if reminder preparation fails, and errors do not expose provider details", async () => {
  let copied = 0,
    sent = 0;
  const result = await scheduledJobs(
    async () => {
      throw new Error("private provider details");
    },
    async () => {
      sent++;
    },
    async () => {
      copied++;
      return { primary_created: true };
    },
  );
  assert.equal(copied, 1);
  assert.equal(sent, 0);
  assert.equal(result.ok, false);
  assert.deepEqual(result.backup, { primary_created: true });
  assert.ok(!JSON.stringify(result).includes("private provider details"));
});

test("backup failure preserves the successful message result and a later run can succeed", async () => {
  const result = await scheduledJobs(
    async () => {},
    async () => ({ sent: 2 }),
    async () => {
      throw new Error("private");
    },
  );
  assert.equal(result.ok, false);
  assert.deepEqual(result.messages, { sent: 2 });
  const retry = await scheduledJobs(
    async () => {},
    async () => ({ sent: 0 }),
    async () => ({ configured: true }),
  );
  assert.equal(retry.ok, true);
});
