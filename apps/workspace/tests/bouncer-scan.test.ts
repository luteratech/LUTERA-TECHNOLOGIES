import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { checkBouncer, scanBouncer } from "../src/lib/bouncer-scan";
import { scannerStatus, scanEvidence } from "../src/lib/evidence-scan";
const token = "bnc_live_fixture_test_only",
  bytes = Buffer.from("synthetic company upload");
const quota = {
  tier: "free",
  scans_used: 12,
  scans_limit: 500,
  resets_at: "2026-12-01T00:00:00Z",
};
const clean = {
  scan_id: "scan_fixture",
  status: "completed",
  verdict: "clean",
  file: { sha256: createHash("sha256").update(bytes).digest("hex") },
};
const success = (data: unknown) =>
  new Response(JSON.stringify({ status: "success", data }), { status: 200 });
function fixture(responses: Response[]) {
  const calls: { url: string; options?: RequestInit }[] = [];
  return {
    calls,
    fetch: async (
      input: Parameters<typeof fetch>[0],
      options?: RequestInit,
    ) => {
      calls.push({ url: String(input), options });
      assert.match(
        String(input),
        /^https:\/\/api\.usebouncer\.dev\/v1\/scan(?:\/|$)/,
      );
      assert.equal(
        (options?.headers as Record<string, string>)["X-API-Key"],
        token,
      );
      assert.equal(options?.redirect, "error");
      assert.equal(options?.cache, "no-store");
      const response = responses.shift();
      assert.ok(response, "Unexpected provider request");
      return response;
    },
  };
}
test("connection checks verify the free plan without submitting a file", async () => {
  const provider = fixture([success(quota)]);
  assert.deepEqual(await checkBouncer(token, provider), {
    used: 12,
    limit: 500,
    remaining: 488,
    resetsAt: quota.resets_at,
    tier: "free",
  });
  assert.equal(provider.calls.length, 1);
  assert.equal(provider.calls[0].options?.body, undefined);
});
test("one submission uses generic filename, polls only the fixed provider, and verifies bytes", async () => {
  const provider = fixture([
    success(quota),
    success({
      scan_id: "scan_fixture",
      status: "pending",
      poll_url: "https://evil.example/",
    }),
    success(clean),
  ]);
  const result = await scanBouncer(bytes, token, {
    ...provider,
    sleep: async () => {},
  });
  assert.equal(result.sha256, clean.file.sha256);
  assert.equal(result.scanId, "scan_fixture");
  assert.equal(
    provider.calls.filter((c) => c.options?.method === "POST").length,
    1,
  );
  assert.equal(
    provider.calls[2].url,
    "https://api.usebouncer.dev/v1/scan/scan_fixture",
  );
  const file = (provider.calls[1].options?.body as FormData).get(
    "file",
  ) as File;
  assert.equal(file.name, "lutera-upload.bin");
  assert.deepEqual(Buffer.from(await file.arrayBuffer()), bytes);
});
test("malicious, suspicious, unknown verdicts and mismatched hashes cannot pass", async () => {
  for (const data of [
    { ...clean, verdict: "malicious" },
    { ...clean, verdict: "suspicious" },
    { ...clean, verdict: "unknown" },
    { ...clean, file: { sha256: "0".repeat(64) } },
    { ...clean, file: {} },
    { scan_id: "scan_fixture", status: "failed" },
  ]) {
    const provider = fixture([success(quota), success(data)]);
    await assert.rejects(scanBouncer(bytes, token, provider));
  }
});
test("depleted quota and non-free plans block before upload", async () => {
  for (const data of [
    { ...quota, scans_used: 500 },
    { ...quota, tier: "pro" },
    { ...quota, scans_limit: 10000 },
  ]) {
    const provider = fixture([success(data)]);
    await assert.rejects(
      scanBouncer(bytes, token, provider),
      /allowance|free plan/,
    );
    assert.equal(provider.calls.length, 1);
  }
});
test("authentication, throttling, network failure and malformed provider replies fail closed without leaking the key", async () => {
  for (const response of [
    new Response("secret provider body", { status: 401 }),
    new Response("quota", { status: 429 }),
    new Response("error", { status: 503 }),
    new Response("not json", { status: 200 }),
    success({}),
    new Response("x".repeat(65537)),
  ]) {
    const provider = fixture([response]);
    await assert.rejects(
      scanBouncer(bytes, token, provider),
      (error: Error) => {
        assert.ok(!error.message.includes(token));
        assert.ok(!error.message.includes("secret provider body"));
        return true;
      },
    );
  }
  await assert.rejects(
    scanBouncer(bytes, token, {
      fetch: async () => {
        throw Error("secret network details");
      },
    }),
    /unavailable/,
  );
});
test("polling is bounded and never resubmits an upload", async () => {
  let clock = 0;
  const provider = fixture([
    success(quota),
    ...Array.from({ length: 22 }, () =>
      success({ scan_id: "scan_fixture", status: "pending" }),
    ),
  ]);
  await assert.rejects(
    scanBouncer(bytes, token, {
      ...provider,
      now: () => clock,
      sleep: async (ms) => {
        clock += ms;
      },
    }),
    /did not finish|timed out/,
  );
  assert.equal(
    provider.calls.filter((c) => c.options?.method === "POST").length,
    1,
  );
  assert.ok(clock < 45000);
});
test("invalid scan identifiers and a changed poll identifier fail closed", async () => {
  for (const data of [
    { scan_id: "../../outside", status: "pending" },
    { scan_id: "https://evil.example/", status: "completed", verdict: "clean" },
  ]) {
    const provider = fixture([success(quota), success(data)]);
    await assert.rejects(scanBouncer(bytes, token, provider));
  }
  const provider = fixture([
    success(quota),
    success({ scan_id: "scan_fixture", status: "pending" }),
    success({ ...clean, scan_id: "scan_other" }),
  ]);
  await assert.rejects(
    scanBouncer(bytes, token, { ...provider, sleep: async () => {} }),
  );
});
test("missing selected Bouncer key and unknown provider never silently bypass scanning", async () => {
  await assert.rejects(scanEvidence(bytes, { provider: "bouncer" }), /key/);
  await assert.rejects(
    scanEvidence(bytes, { provider: "invalid" }),
    /configured/,
  );
  assert.deepEqual(scannerStatus({ apiKey: token }), {
    provider: "bouncer",
    configured: true,
  });
  assert.deepEqual(scannerStatus({ host: "private.example" }), {
    provider: "clamav",
    configured: true,
  });
  assert.deepEqual(scannerStatus({}), { provider: "none", configured: false });
});
